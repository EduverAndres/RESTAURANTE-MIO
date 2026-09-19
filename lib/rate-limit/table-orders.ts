import 'server-only'

import type { SupabaseClient } from '@supabase/supabase-js'
import {
  TABLE_ORDER_IP_POLICY,
  TABLE_ORDER_POLICY,
  rateLimitIdentifier,
  type RateLimitDecision,
} from '@/lib/rate-limit/policy'
import {
  enforceRateLimit,
  postgresRateLimitStore,
  type RateLimitCheck,
} from '@/lib/rate-limit/store'
import type { Database } from '@/types/database'

export interface TableOrderRequester {
  /** Raw QR token from the URL. Hashed before it reaches the database. */
  token: string
  /** Client address, or null when no proxy header was present. */
  ip: string | null
}

/**
 * The checks guarding `placeTableOrder`, the one write in this app that any
 * holder of a QR token can perform unauthenticated.
 *
 * Two budgets, because neither sees what the other does: the per-table one
 * stops a single token flooding a Kanban board, and the per-address one
 * stops a script that has collected several tokens. The address check is
 * skipped entirely when there is no proxy header rather than bucketing every
 * such request under one shared key — that would make a local run, or a
 * misconfigured proxy, limit all tables at once.
 */
export function tableOrderRateLimitChecks(
  requester: TableOrderRequester,
): RateLimitCheck[] {
  const checks: RateLimitCheck[] = [
    {
      policy: TABLE_ORDER_POLICY,
      identifier: rateLimitIdentifier(requester.token),
    },
  ]
  if (requester.ip) {
    checks.push({
      policy: TABLE_ORDER_IP_POLICY,
      identifier: rateLimitIdentifier(requester.ip),
    })
  }
  return checks
}

/** Records the attempt and says whether this table order may proceed. */
export function checkTableOrderRateLimit(
  admin: SupabaseClient<Database>,
  requester: TableOrderRequester,
): Promise<RateLimitDecision> {
  return enforceRateLimit(
    postgresRateLimitStore(admin),
    tableOrderRateLimitChecks(requester),
  )
}
