import { describe, expect, it } from 'vitest'
import { orderIdSchema } from '@/lib/validations/orders'

describe('orderIdSchema', () => {
  it('accepts a UUID', () => {
    expect(
      orderIdSchema.safeParse('11111111-1111-4111-8111-111111111111').success,
    ).toBe(true)
  })

  it('rejects anything else, including a short code', () => {
    for (const value of ['A1B2', '', 'not-a-uuid', 42, null]) {
      expect(orderIdSchema.safeParse(value).success).toBe(false)
    }
  })
})
