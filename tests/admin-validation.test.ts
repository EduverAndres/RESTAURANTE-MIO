import { describe, expect, it } from 'vitest'
import { periodDateSchema, storePlanSchema } from '@/lib/validations/admin'

describe('storePlanSchema', () => {
  // The regex once lost its backslashes (`^d{4}-d{2}-d{2}$`) and only
  // accepted the literal text "dddd-dd-dd": every founder store failed to
  // save its plan with «Fecha inválida.».
  it('accepts a real founder date', () => {
    expect(
      storePlanSchema.safeParse({ plan: 'vip', founderUntil: '2027-02-03' })
        .success,
    ).toBe(true)
  })

  it('accepts no founder date', () => {
    expect(
      storePlanSchema.safeParse({ plan: 'normal', founderUntil: null }).success,
    ).toBe(true)
  })

  it('rejects text that is not a date', () => {
    for (const founderUntil of ['dddd-dd-dd', '03/02/2027', '2027-2-3', '']) {
      expect(
        storePlanSchema.safeParse({ plan: 'mediano', founderUntil }).success,
      ).toBe(false)
    }
  })

  it('validates dates exactly like the payout periods', () => {
    for (const value of ['2027-02-03', 'dddd-dd-dd', '2027-2-3']) {
      expect(
        storePlanSchema.safeParse({ plan: 'vip', founderUntil: value }).success,
      ).toBe(periodDateSchema.safeParse(value).success)
    }
  })
})
