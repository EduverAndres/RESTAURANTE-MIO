import { describe, expect, it } from 'vitest'
import { paidAmountMatches, toCents } from '@/lib/payments/amount'

describe('paidAmountMatches', () => {
  it('accepts exactly the order total, in cents', () => {
    expect(paidAmountMatches(49000, 4900000)).toBe(true)
    expect(paidAmountMatches('49000.5', 4900050)).toBe(true)
  })

  it('rejects any other amount', () => {
    expect(paidAmountMatches(49000, 4899999)).toBe(false)
    expect(paidAmountMatches(49000, 100)).toBe(false)
  })

  it('fails closed on unknown or invalid values', () => {
    expect(paidAmountMatches(49000, undefined)).toBe(false)
    expect(paidAmountMatches(49000, null)).toBe(false)
    expect(paidAmountMatches(null, 4900000)).toBe(false)
    expect(paidAmountMatches('abc', 0)).toBe(false)
    expect(paidAmountMatches(49000, Number.NaN)).toBe(false)
  })

  it('rounds totals the way gateways do', () => {
    expect(toCents(0.1 + 0.2)).toBe(30)
  })
})
