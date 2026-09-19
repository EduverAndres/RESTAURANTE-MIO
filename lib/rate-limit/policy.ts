import { createHash } from 'node:crypto'

// Pure rate-limiting decisions: window maths, allow/deny and retry-after,
// with no database and no request in sight. The counter itself is produced
// atomically by Postgres (see `lib/rate-limit/store.ts`); everything that
// interprets it lives here, the same way `lib/payments/transitions.ts` holds
// the payment rules that `apply-status.ts` merely writes out.

export interface RateLimitPolicy {
  /** Value stored in `rate_limits.bucket`; one budget per bucket. */
  bucket: string
  /** Hits allowed inside one window, inclusive. */
  limit: number
  /** Length of the fixed window, in seconds. */
  windowSeconds: number
}

export interface RateLimitCounter {
  /** Hits recorded in the current window, including the one being decided. */
  count: number
  /** Instant the current window opened. */
  windowStart: Date
}

export interface RateLimitDecision {
  allowed: boolean
  /** Hits still available in this window; 0 once the budget is spent. */
  remaining: number
  /** Seconds to wait before retrying; 0 while allowed. */
  retryAfterSeconds: number
  /** Instant the window reopens. */
  resetAt: Date
}

/**
 * Turns a counter into a decision.
 *
 * The count is the value the store handed back for *this* hit, so the caller
 * never reads a shared counter and writes it back: two concurrent requests
 * receive two different counts and a limit of 1 lets exactly one through.
 * See `consume_rate_limit` in the migration for why that is true.
 */
export function decideRateLimit(
  counter: RateLimitCounter,
  policy: RateLimitPolicy,
  now: Date,
): RateLimitDecision {
  const windowMs = policy.windowSeconds * 1000
  const elapsedReset = new Date(counter.windowStart.getTime() + windowMs)

  // Defensive: the store rolls the window over itself, so a counter this old
  // should not reach us. If one does, honour the rollover rather than deny
  // forever on a stale row.
  if (now.getTime() >= elapsedReset.getTime()) {
    return {
      allowed: 1 <= policy.limit,
      remaining: Math.max(0, policy.limit - 1),
      retryAfterSeconds: 0,
      resetAt: new Date(now.getTime() + windowMs),
    }
  }

  const allowed = counter.count <= policy.limit
  return {
    allowed,
    remaining: Math.max(0, policy.limit - counter.count),
    // Round up, and never below a second: a sub-second retry-after invites an
    // immediate retry that is still inside the same window.
    retryAfterSeconds: allowed
      ? 0
      : Math.max(1, Math.ceil((elapsedReset.getTime() - now.getTime()) / 1000)),
    resetAt: elapsedReset,
  }
}

/** The decision a caller gets when nothing was checked, or checking failed. */
export function allowedDecision(now: Date): RateLimitDecision {
  return {
    allowed: true,
    remaining: Number.POSITIVE_INFINITY,
    retryAfterSeconds: 0,
    resetAt: now,
  }
}

/**
 * Combines the decisions of several policies applied to the same request:
 * any denial denies, and the caller is told to wait for the longest of them.
 */
export function strictestDecision(
  decisions: readonly RateLimitDecision[],
  now: Date = new Date(),
): RateLimitDecision {
  return decisions.reduce<RateLimitDecision>(
    (strictest, decision) => ({
      allowed: strictest.allowed && decision.allowed,
      remaining: Math.min(strictest.remaining, decision.remaining),
      retryAfterSeconds: Math.max(
        strictest.retryAfterSeconds,
        decision.retryAfterSeconds,
      ),
      resetAt:
        decision.resetAt.getTime() > strictest.resetAt.getTime()
          ? decision.resetAt
          : strictest.resetAt,
    }),
    allowedDecision(now),
  )
}

/**
 * Stable, opaque key for the thing being limited.
 *
 * Hashed on purpose: the parts include a QR table token, which is the secret
 * that authorises ordering from a table. Storing it verbatim in
 * `rate_limits` would copy that secret into a second table (and into every
 * backup of it) for no benefit — the limiter only ever needs equality.
 * Parts are length-prefixed so `('a','bc')` and `('ab','c')` cannot collide.
 */
export function rateLimitIdentifier(...parts: readonly string[]): string {
  const material = parts.map((part) => `${part.length}:${part}`).join('|')
  return createHash('sha256').update(material).digest('hex').slice(0, 32)
}

/**
 * Orders placed from one physical table.
 *
 * This is the real guard: a QR token is all it takes to insert `pending`
 * orders as `anon`, and a flood of them buries a restaurant's Kanban board.
 * Six in five minutes is far above any dining pattern — a table that adds a
 * round of drinks does so minutes apart, and a split bill is still one order
 * per person on a table of six — while a script gets throttled after the
 * sixth insert instead of the six-thousandth.
 */
export const TABLE_ORDER_POLICY: RateLimitPolicy = {
  bucket: 'table_order',
  limit: 6,
  windowSeconds: 300,
}

/**
 * Orders placed from one network address.
 *
 * Deliberately loose. Guests order from the restaurant's own wifi, so a whole
 * dining room shares one NAT address and a tight per-address budget would
 * lock out real customers at lunchtime. It exists only to catch what the
 * per-table budget cannot see: one host cycling through many stolen tokens.
 * Thirty in five minutes is more orders than a busy venue takes from a single
 * address, and still five times cheaper than letting that script run free.
 */
export const TABLE_ORDER_IP_POLICY: RateLimitPolicy = {
  bucket: 'table_order_ip',
  limit: 30,
  windowSeconds: 300,
}
