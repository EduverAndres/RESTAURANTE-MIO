import { describe, expect, it } from 'vitest'
import {
  clampDiscounts,
  couponDiscount,
  creditDiscount,
  loyaltyStatus,
  normalizeCouponCode,
  rewardDiscount,
  type CouponRule,
} from '@/lib/discounts'

const coupon: CouponRule = {
  kind: 'percent',
  value: 10,
  min_order: 20_000,
  starts_at: '2026-11-01',
  ends_at: '2026-11-30',
  max_uses: 100,
  active: true,
}
const TODAY = '2026-11-05'
const unused = { total: 0, byCustomer: 0 }

describe('normalizeCouponCode', () => {
  it('reads codes the way people type them', () => {
    expect(normalizeCouponCode('  bienvenido 10 ')).toBe('BIENVENIDO10')
    expect(normalizeCouponCode('arepa-2x1')).toBe('AREPA2X1')
  })
})

describe('couponDiscount', () => {
  it('takes a percentage of the subtotal, rounded to the peso', () => {
    expect(couponDiscount(coupon, 45_550, TODAY, unused)).toEqual({
      ok: true,
      amount: 4_555,
    })
  })

  it('takes a fixed amount, never more than the subtotal', () => {
    const fixed = { ...coupon, kind: 'fixed' as const, value: 50_000 }
    expect(couponDiscount(fixed, 30_000, TODAY, unused)).toEqual({
      ok: true,
      amount: 30_000,
    })
  })

  it('explains every refusal in a sentence the customer can act on', () => {
    const cases: [
      Partial<CouponRule>,
      number,
      { total: number; byCustomer: number },
      RegExp,
    ][] = [
      [{ active: false }, 30_000, unused, /no está activo/],
      [{ starts_at: '2026-11-10' }, 30_000, unused, /todavía no/],
      [{ ends_at: '2026-11-04' }, 30_000, unused, /venció/],
      [{}, 19_000, unused, /mínimo/],
      [{ max_uses: 3 }, 30_000, { total: 3, byCustomer: 0 }, /se agotó/],
      [{}, 30_000, { total: 1, byCustomer: 1 }, /ya usaste/i],
    ]
    for (const [overrides, subtotal, usage, message] of cases) {
      const result = couponDiscount(
        { ...coupon, ...overrides },
        subtotal,
        TODAY,
        usage,
      )
      expect(result.ok).toBe(false)
      if (!result.ok) expect(result.error).toMatch(message)
    }
  })

  it('is valid on its first and last day', () => {
    expect(couponDiscount(coupon, 30_000, '2026-11-01', unused).ok).toBe(true)
    expect(couponDiscount(coupon, 30_000, '2026-11-30', unused).ok).toBe(true)
  })
})

describe('loyaltyStatus', () => {
  it('counts the card in progress and the rewards waiting', () => {
    expect(loyaltyStatus(0, 0, 8)).toEqual({ stamps: 0, available: 0 })
    expect(loyaltyStatus(5, 0, 8)).toEqual({ stamps: 5, available: 0 })
    expect(loyaltyStatus(8, 0, 8)).toEqual({ stamps: 0, available: 1 })
    expect(loyaltyStatus(19, 1, 8)).toEqual({ stamps: 3, available: 1 })
  })

  it('never goes negative when more were redeemed than earned', () => {
    // A merchant who raised the card size after rewards were used.
    expect(loyaltyStatus(8, 2, 10)).toEqual({ stamps: 8, available: 0 })
  })
})

describe('rewardDiscount / creditDiscount', () => {
  it('caps the reward at the subtotal', () => {
    expect(rewardDiscount(8_000, 30_000)).toBe(8_000)
    expect(rewardDiscount(8_000, 5_000)).toBe(5_000)
  })

  it('applies a credit only above its minimum and before it expires', () => {
    const credit = {
      amount: 5_000,
      min_order: 25_000,
      expires_at: '2026-12-31T23:59:59.000Z',
    }
    const now = new Date('2026-11-05T15:00:00.000Z')
    expect(creditDiscount(credit, 30_000, now)).toBe(5_000)
    expect(creditDiscount(credit, 24_000, now)).toBe(0)
    expect(
      creditDiscount(credit, 30_000, new Date('2027-01-01T00:00:00.000Z')),
    ).toBe(0)
  })
})

describe('clampDiscounts', () => {
  it('keeps both discounts inside the subtotal, merchant first', () => {
    expect(clampDiscounts(30_000, 4_000, 5_000)).toEqual({
      merchantDiscount: 4_000,
      platformDiscount: 5_000,
    })
    expect(clampDiscounts(6_000, 4_000, 5_000)).toEqual({
      merchantDiscount: 4_000,
      platformDiscount: 2_000,
    })
    expect(clampDiscounts(3_000, 4_000, 5_000)).toEqual({
      merchantDiscount: 3_000,
      platformDiscount: 0,
    })
    expect(clampDiscounts(10_000, -5, Number.NaN)).toEqual({
      merchantDiscount: 0,
      platformDiscount: 0,
    })
  })
})
