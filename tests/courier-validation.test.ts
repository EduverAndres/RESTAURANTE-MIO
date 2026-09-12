import { describe, expect, it } from 'vitest'
import { courierPositionSchema } from '@/lib/validations/courier'

describe('courierPositionSchema', () => {
  it('accepts a valid fix and keeps the heading', () => {
    const result = courierPositionSchema.safeParse({
      lat: 4.65,
      lng: -74.08,
      heading: 90,
    })
    expect(result.success).toBe(true)
    if (result.success)
      expect(result.data).toEqual({ lat: 4.65, lng: -74.08, heading: 90 })
  })

  it('normalises a missing or invalid heading to null', () => {
    expect(
      courierPositionSchema.safeParse({ lat: 1, lng: 1 }).data?.heading,
    ).toBeNull()
    expect(
      courierPositionSchema.safeParse({ lat: 1, lng: 1, heading: null }).data
        ?.heading,
    ).toBeNull()
    expect(
      courierPositionSchema.safeParse({ lat: 1, lng: 1, heading: Number.NaN })
        .data?.heading,
    ).toBeNull()
  })

  it('wraps the heading into [0, 360)', () => {
    expect(
      courierPositionSchema.safeParse({ lat: 1, lng: 1, heading: 370 }).data
        ?.heading,
    ).toBe(10)
    expect(
      courierPositionSchema.safeParse({ lat: 1, lng: 1, heading: -90 }).data
        ?.heading,
    ).toBe(270)
  })

  it('rejects out-of-range or non-finite coordinates', () => {
    expect(courierPositionSchema.safeParse({ lat: 91, lng: 0 }).success).toBe(
      false,
    )
    expect(courierPositionSchema.safeParse({ lat: 0, lng: -181 }).success).toBe(
      false,
    )
    expect(
      courierPositionSchema.safeParse({ lat: Number.NaN, lng: 0 }).success,
    ).toBe(false)
    expect(courierPositionSchema.safeParse({ lat: '4', lng: 0 }).success).toBe(
      false,
    )
  })
})
