import { describe, expect, it } from 'vitest'
import { couponSchema, loyaltySchema } from '@/lib/validations/loyalty'

const coupon = {
  code: ' bienvenido 10 ',
  kind: 'percent' as const,
  value: 10,
  minOrder: 20000,
  startsAt: null,
  endsAt: null,
  maxUses: null,
}

describe('couponSchema', () => {
  it('normalises the code the way the checkout reads it', () => {
    const parsed = couponSchema.parse(coupon)
    expect(parsed.code).toBe('BIENVENIDO10')
  })

  it('refuses a percentage over 100, a tiny fixed discount and reversed dates', () => {
    for (const bad of [
      { ...coupon, value: 120 },
      { ...coupon, kind: 'fixed' as const, value: 100 },
      { ...coupon, startsAt: '2026-12-10', endsAt: '2026-12-01' },
      { ...coupon, code: 'ab' },
    ]) {
      expect(couponSchema.safeParse(bad).success).toBe(false)
    }
  })
})

describe('loyaltySchema', () => {
  const card = {
    enabled: true,
    stampsRequired: 8,
    minOrder: 15000,
    rewardLabel: 'una arepa de huevo',
    rewardValue: 6000,
  }

  it('accepts a complete card', () => {
    expect(loyaltySchema.safeParse(card).success).toBe(true)
  })

  it('needs a named reward with a value only when the card is on', () => {
    expect(loyaltySchema.safeParse({ ...card, rewardLabel: '' }).success).toBe(
      false,
    )
    expect(loyaltySchema.safeParse({ ...card, rewardValue: 0 }).success).toBe(
      false,
    )
    expect(
      loyaltySchema.safeParse({
        ...card,
        enabled: false,
        rewardLabel: '',
        rewardValue: 0,
      }).success,
    ).toBe(true)
  })

  it('keeps the card between 3 and 20 stamps', () => {
    expect(
      loyaltySchema.safeParse({ ...card, stampsRequired: 2 }).success,
    ).toBe(false)
    expect(
      loyaltySchema.safeParse({ ...card, stampsRequired: 21 }).success,
    ).toBe(false)
  })
})
