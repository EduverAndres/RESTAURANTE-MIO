import { describe, expect, it, vi } from 'vitest'
import {
  TABLE_ORDER_IP_POLICY,
  TABLE_ORDER_POLICY,
  rateLimitIdentifier,
} from '@/lib/rate-limit/policy'
import { tableOrderRateLimitChecks } from '@/lib/rate-limit/table-orders'

vi.mock('server-only', () => ({}))

const TOKEN = 'qr-token-super-secret'

describe('tableOrderRateLimitChecks', () => {
  it('budgets the table and the address separately', () => {
    const checks = tableOrderRateLimitChecks({ token: TOKEN, ip: '203.0.113.7' })
    expect(checks.map((check) => check.policy)).toEqual([
      TABLE_ORDER_POLICY,
      TABLE_ORDER_IP_POLICY,
    ])
  })

  it('hashes both keys, so no QR token or address is stored verbatim', () => {
    const checks = tableOrderRateLimitChecks({ token: TOKEN, ip: '203.0.113.7' })
    expect(checks[0]?.identifier).toBe(rateLimitIdentifier(TOKEN))
    expect(checks[1]?.identifier).toBe(rateLimitIdentifier('203.0.113.7'))
    for (const check of checks) {
      expect(check.identifier).not.toContain(TOKEN)
      expect(check.identifier).not.toContain('203.0.113.7')
    }
  })

  it('skips the address budget when no proxy header was present', () => {
    // Bucketing every header-less request under one shared key would let a
    // local run, or a misconfigured proxy, limit every table at once.
    const checks = tableOrderRateLimitChecks({ token: TOKEN, ip: null })
    expect(checks).toHaveLength(1)
    expect(checks[0]?.policy).toBe(TABLE_ORDER_POLICY)
  })

  it('keeps two tables in different buckets even from the same address', () => {
    const one = tableOrderRateLimitChecks({ token: 'table-1', ip: '203.0.113.7' })
    const two = tableOrderRateLimitChecks({ token: 'table-2', ip: '203.0.113.7' })
    expect(one[0]?.identifier).not.toBe(two[0]?.identifier)
    expect(one[1]?.identifier).toBe(two[1]?.identifier)
  })
})
