import { describe, expect, it } from 'vitest'
import {
  TABLE_ORDER_IP_POLICY,
  TABLE_ORDER_POLICY,
  decideRateLimit,
  rateLimitIdentifier,
  strictestDecision,
  type RateLimitPolicy,
} from '@/lib/rate-limit/policy'

const NOW = new Date('2026-09-19T08:05:00.000Z')
const WINDOW_START = new Date('2026-09-19T08:04:00.000Z')

const POLICY: RateLimitPolicy = {
  bucket: 'test',
  limit: 3,
  windowSeconds: 300,
}

function decide(count: number, windowStart = WINDOW_START) {
  return decideRateLimit({ count, windowStart }, POLICY, NOW)
}

describe('decideRateLimit', () => {
  it('allows a hit inside the limit and counts down what is left', () => {
    expect(decide(1)).toEqual({
      allowed: true,
      remaining: 2,
      retryAfterSeconds: 0,
      resetAt: new Date('2026-09-19T08:09:00.000Z'),
    })
  })

  it('allows the hit that exactly reaches the limit, with nothing left', () => {
    const decision = decide(3)
    expect(decision.allowed).toBe(true)
    expect(decision.remaining).toBe(0)
  })

  it('denies the first hit past the limit and says when to come back', () => {
    const decision = decide(4)
    expect(decision.allowed).toBe(false)
    expect(decision.remaining).toBe(0)
    // The window opened at 08:04 and lasts 300s, so it reopens at 08:09.
    expect(decision.retryAfterSeconds).toBe(240)
  })

  it('never reports a retry-after below one second', () => {
    // A hit landing in the last fraction of the window would otherwise round
    // down to 0 and invite an immediate retry that is still denied.
    const decision = decideRateLimit(
      { count: 9, windowStart: new Date(NOW.getTime() - 299_500) },
      POLICY,
      NOW,
    )
    expect(decision.retryAfterSeconds).toBe(1)
  })

  it('treats a counter whose window already elapsed as a fresh window', () => {
    // The store resets the window itself; this is the defensive case where a
    // stale row is read anyway, and it must never deny forever.
    const decision = decideRateLimit(
      { count: 99, windowStart: new Date(NOW.getTime() - 600_000) },
      POLICY,
      NOW,
    )
    expect(decision.allowed).toBe(true)
    expect(decision.remaining).toBe(POLICY.limit - 1)
  })

  it('decides from the count the store handed back, never by reading first', () => {
    // Concurrency contract: the store increments atomically and hands each
    // caller its own distinct count, so two requests racing on a limit of 1
    // see 1 and 2 and exactly one of them passes. A read-then-write limiter
    // would hand both callers the same count and let both through.
    const single: RateLimitPolicy = { ...POLICY, limit: 1 }
    const first = decideRateLimit({ count: 1, windowStart: WINDOW_START }, single, NOW)
    const second = decideRateLimit({ count: 2, windowStart: WINDOW_START }, single, NOW)
    expect([first.allowed, second.allowed]).toEqual([true, false])
  })
})

describe('strictestDecision', () => {
  it('denies as soon as one policy denies, keeping the longest wait', () => {
    const allowed = decide(1)
    const denied = decide(4)
    const decision = strictestDecision([allowed, denied])
    expect(decision.allowed).toBe(false)
    expect(decision.retryAfterSeconds).toBe(240)
  })

  it('keeps the smallest remaining allowance when everything passes', () => {
    expect(strictestDecision([decide(1), decide(3)]).remaining).toBe(0)
    expect(strictestDecision([decide(1), decide(3)]).allowed).toBe(true)
  })

  it('allows when there is nothing to decide', () => {
    expect(strictestDecision([]).allowed).toBe(true)
  })
})

describe('rateLimitIdentifier', () => {
  const TOKEN = 'qr-token-super-secret'

  it('never carries a raw part through, so no QR token reaches the database', () => {
    const identifier = rateLimitIdentifier(TOKEN)
    expect(identifier).not.toContain(TOKEN)
    expect(identifier).not.toContain('qr-token')
  })

  it('is stable for the same parts and distinct for different ones', () => {
    expect(rateLimitIdentifier(TOKEN)).toBe(rateLimitIdentifier(TOKEN))
    expect(rateLimitIdentifier(TOKEN)).not.toBe(rateLimitIdentifier(`${TOKEN}x`))
  })

  it('does not collide when the same parts are joined differently', () => {
    expect(rateLimitIdentifier('a', 'bc')).not.toBe(rateLimitIdentifier('ab', 'c'))
  })

  it('stays short enough to be a cheap index key', () => {
    expect(rateLimitIdentifier(TOKEN, '203.0.113.7')).toHaveLength(32)
  })
})

describe('table order policies', () => {
  it('limits one table far more tightly than one address', () => {
    // Guests at a restaurant share a single NAT address, so the per-address
    // budget has to be the loose one; the per-table budget is the real guard.
    expect(TABLE_ORDER_POLICY.limit).toBeLessThan(TABLE_ORDER_IP_POLICY.limit)
    expect(TABLE_ORDER_POLICY.bucket).not.toBe(TABLE_ORDER_IP_POLICY.bucket)
  })

  it('uses windows a human ordering pattern cannot trip', () => {
    for (const policy of [TABLE_ORDER_POLICY, TABLE_ORDER_IP_POLICY]) {
      expect(policy.windowSeconds).toBeGreaterThanOrEqual(60)
      expect(policy.limit).toBeGreaterThan(1)
    }
  })
})
