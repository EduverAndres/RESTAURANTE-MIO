import 'server-only'

import type { SupabaseClient } from '@supabase/supabase-js'
import { logger } from '@/lib/log/logger'
import {
  allowedDecision,
  decideRateLimit,
  strictestDecision,
  type RateLimitCounter,
  type RateLimitDecision,
  type RateLimitPolicy,
} from '@/lib/rate-limit/policy'
import type { Database } from '@/types/database'

// The IO half of the limiter: it only fetches counters, it never decides
// anything (that is `lib/rate-limit/policy.ts`). Same split as
// `lib/payments`, where `transitions.ts` holds the rules and
// `apply-status.ts` only writes their result out.

export interface RateLimitCheck {
  policy: RateLimitPolicy
  /** Opaque key from `rateLimitIdentifier`; never a raw token. */
  identifier: string
}

/**
 * The seam. Everything above this line is store-agnostic, so moving to Redis
 * is one new implementation of this interface and one line where the store is
 * constructed — no caller changes.
 */
export interface RateLimitStore {
  /** Records one hit and returns the resulting counter. Throws on failure. */
  consume(check: RateLimitCheck): Promise<RateLimitCounter>
}

interface ConsumeRow {
  hit_count: number
  window_start: string
}

/**
 * Postgres-backed store.
 *
 * In-memory counters are worthless here: every Vercel invocation may run on a
 * different instance, so an in-process map limits nothing. The counter has to
 * live where all instances can see it, and this app already has exactly one
 * such place.
 *
 * The whole check is a single `consume_rate_limit(...)` call. That is not a
 * round-trip optimisation, it is the correctness requirement: read-then-write
 * from JavaScript lets two concurrent requests read the same count and both
 * pass a limit of 1. The function does the increment inside one statement
 * whose `on conflict do update` holds the row lock, so concurrent callers are
 * serialised by Postgres and each gets its own count.
 */
export function postgresRateLimitStore(
  admin: SupabaseClient<Database>,
): RateLimitStore {
  return {
    async consume({ policy, identifier }): Promise<RateLimitCounter> {
      const { data, error } = await admin.rpc('consume_rate_limit', {
        p_bucket: policy.bucket,
        p_identifier: identifier,
        p_window_seconds: policy.windowSeconds,
      })
      if (error) throw new Error(error.message)
      const row = (Array.isArray(data) ? data[0] : data) as ConsumeRow | null
      if (!row) throw new Error('consume_rate_limit returned no row')
      return {
        count: Number(row.hit_count),
        windowStart: new Date(row.window_start),
      }
    },
  }
}

/**
 * Applies every policy to one request and returns the strictest answer.
 *
 * Fails OPEN. If the limiter is unreachable — the function is missing, the
 * pooler is saturated, the migration has not been applied yet — the request
 * is allowed through and the failure is logged. The trade-off is deliberate
 * and worth stating plainly: failing closed would mean a broken counter
 * table stops a restaurant taking orders, i.e. an availability control that
 * causes the outage it exists to prevent. Abuse that slips through while the
 * limiter is down is still bounded by RLS, the order validation and the
 * checks the store itself performs; a shop that cannot sell is not.
 */
export async function enforceRateLimit(
  store: RateLimitStore,
  checks: readonly RateLimitCheck[],
  now: Date = new Date(),
): Promise<RateLimitDecision> {
  if (checks.length === 0) return allowedDecision(now)
  try {
    const counters = await Promise.all(
      checks.map((check) => store.consume(check)),
    )
    return strictestDecision(
      counters.map((counter, index) =>
        decideRateLimit(counter, checks[index].policy, now),
      ),
      now,
    )
  } catch (error) {
    logger.error(
      'rate_limit.unavailable',
      { buckets: checks.map((check) => check.policy.bucket) },
      error,
    )
    return allowedDecision(now)
  }
}
