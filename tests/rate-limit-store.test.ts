import type { SupabaseClient } from '@supabase/supabase-js'
import { afterEach, describe, expect, it, vi } from 'vitest'
import {
  TABLE_ORDER_IP_POLICY,
  TABLE_ORDER_POLICY,
  type RateLimitCounter,
} from '@/lib/rate-limit/policy'
import {
  enforceRateLimit,
  postgresRateLimitStore,
  type RateLimitCheck,
  type RateLimitStore,
} from '@/lib/rate-limit/store'
import type { Database } from '@/types/database'

vi.mock('server-only', () => ({}))

const NOW = new Date('2026-09-19T08:05:00.000Z')
const WINDOW_START = '2026-09-19T08:04:00.000Z'

interface RpcCall {
  name: string
  args: Record<string, unknown>
}

function fakeAdmin(
  result: { data?: unknown; error?: { message: string } | null } = {},
) {
  const calls: RpcCall[] = []
  const admin = {
    rpc: async (name: string, args: Record<string, unknown>) => {
      calls.push({ name, args })
      return { data: result.data ?? null, error: result.error ?? null }
    },
    // A limiter that read the counter first and wrote it back would need
    // these; reaching for one is the bug this fake makes impossible.
    from() {
      throw new Error('the limiter must not read or write the table directly')
    },
  }
  return { admin: admin as unknown as SupabaseClient<Database>, calls }
}

afterEach(() => {
  vi.restoreAllMocks()
})

describe('postgresRateLimitStore', () => {
  it('consumes a hit with exactly one round trip to the atomic function', async () => {
    const { admin, calls } = fakeAdmin({
      data: [{ hit_count: 2, window_start: WINDOW_START }],
    })
    const counter = await postgresRateLimitStore(admin).consume({
      policy: TABLE_ORDER_POLICY,
      identifier: 'abc',
    })
    expect(calls).toEqual([
      {
        name: 'consume_rate_limit',
        args: {
          p_bucket: 'table_order',
          p_identifier: 'abc',
          p_window_seconds: TABLE_ORDER_POLICY.windowSeconds,
        },
      },
    ])
    expect(counter).toEqual<RateLimitCounter>({
      count: 2,
      windowStart: new Date(WINDOW_START),
    })
  })

  it('accepts the single row whether the driver unwraps it or not', async () => {
    const { admin } = fakeAdmin({
      data: { hit_count: 7, window_start: WINDOW_START },
    })
    const counter = await postgresRateLimitStore(admin).consume({
      policy: TABLE_ORDER_POLICY,
      identifier: 'abc',
    })
    expect(counter.count).toBe(7)
  })

  it('throws when the function errors, so the caller decides how to fail', async () => {
    const { admin } = fakeAdmin({ error: { message: 'connection refused' } })
    await expect(
      postgresRateLimitStore(admin).consume({
        policy: TABLE_ORDER_POLICY,
        identifier: 'abc',
      }),
    ).rejects.toThrow(/connection refused/)
  })

  it('throws when the function answers no row at all', async () => {
    const { admin } = fakeAdmin({ data: [] })
    await expect(
      postgresRateLimitStore(admin).consume({
        policy: TABLE_ORDER_POLICY,
        identifier: 'abc',
      }),
    ).rejects.toThrow()
  })
})

function storeReturning(counts: readonly number[]): RateLimitStore {
  let index = 0
  return {
    async consume(): Promise<RateLimitCounter> {
      const count = counts[index] ?? 1
      index += 1
      return { count, windowStart: new Date(WINDOW_START) }
    },
  }
}

const CHECKS: readonly RateLimitCheck[] = [
  { policy: TABLE_ORDER_POLICY, identifier: 'table' },
  { policy: TABLE_ORDER_IP_POLICY, identifier: 'ip' },
]

describe('enforceRateLimit', () => {
  it('allows while every policy has budget left', async () => {
    const decision = await enforceRateLimit(storeReturning([1, 1]), CHECKS, NOW)
    expect(decision.allowed).toBe(true)
  })

  it('denies as soon as one policy is over, with its retry-after', async () => {
    const decision = await enforceRateLimit(
      storeReturning([TABLE_ORDER_POLICY.limit + 1, 1]),
      CHECKS,
      NOW,
    )
    expect(decision.allowed).toBe(false)
    expect(decision.retryAfterSeconds).toBe(240)
  })

  it('denies a second concurrent request that a read-then-write would let in', async () => {
    // Both requests are in flight at once. The function hands one of them 1
    // and the other 2, because the increment happens inside a single
    // statement that takes the row lock; neither ever sees a stale count.
    const store = storeReturning([1, 2])
    const single = [{ policy: { ...TABLE_ORDER_POLICY, limit: 1 }, identifier: 'table' }]
    const [first, second] = await Promise.all([
      enforceRateLimit(store, single, NOW),
      enforceRateLimit(store, single, NOW),
    ])
    expect([first.allowed, second.allowed]).toEqual([true, false])
  })

  it('fails OPEN and logs when the limiter itself is broken', async () => {
    const error = vi.spyOn(console, 'error').mockImplementation(() => {})
    const broken: RateLimitStore = {
      async consume() {
        throw new Error('rate_limits is gone')
      },
    }
    const decision = await enforceRateLimit(broken, CHECKS, NOW)
    expect(decision.allowed).toBe(true)
    expect(error).toHaveBeenCalledTimes(1)
    const record = JSON.parse(error.mock.calls[0]?.[0] as string) as {
      event: string
      context?: Record<string, unknown>
    }
    expect(record.event).toBe('rate_limit.unavailable')
    expect(record.context?.buckets).toEqual(['table_order', 'table_order_ip'])
  })

  it('allows when there is nothing to check', async () => {
    const decision = await enforceRateLimit(storeReturning([]), [], NOW)
    expect(decision.allowed).toBe(true)
  })
})
