import { describe, expect, it } from 'vitest'
import {
  advanceOrderInputSchema,
  courierPositionSchema,
} from '@/lib/validations/courier'

describe('courierPositionSchema', () => {
  it('accepts a valid fix and keeps the heading', () => {
    const result = courierPositionSchema.safeParse({
      lat: 4.65,
      lng: -74.08,
      heading: 90,
    })
    expect(result.success).toBe(true)
    if (result.success)
      expect(result.data).toEqual({
        lat: 4.65,
        lng: -74.08,
        heading: 90,
        accuracyM: null,
      })
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

describe('courierPositionSchema accuracy', () => {
  it('keeps a finite, non-negative accuracy in metres', () => {
    expect(
      courierPositionSchema.safeParse({ lat: 1, lng: 1, accuracyM: 12.5 }).data
        ?.accuracyM,
    ).toBe(12.5)
  })

  it('normalises a missing, negative or non-finite accuracy to null', () => {
    expect(
      courierPositionSchema.safeParse({ lat: 1, lng: 1 }).data?.accuracyM,
    ).toBeNull()
    expect(
      courierPositionSchema.safeParse({ lat: 1, lng: 1, accuracyM: -3 }).data
        ?.accuracyM,
    ).toBeNull()
    expect(
      courierPositionSchema.safeParse({
        lat: 1,
        lng: 1,
        accuracyM: Number.POSITIVE_INFINITY,
      }).data?.accuracyM,
    ).toBeNull()
    expect(
      courierPositionSchema.safeParse({ lat: 1, lng: 1, accuracyM: '5' }).data
        ?.accuracyM,
    ).toBeNull()
  })
})

describe('advanceOrderInputSchema', () => {
  it('accepts no input, an empty object and a four-digit code with spaces around it', () => {
    expect(advanceOrderInputSchema.safeParse(undefined).success).toBe(true)
    expect(advanceOrderInputSchema.safeParse({}).success).toBe(true)
    expect(advanceOrderInputSchema.safeParse({ code: ' 4821 ' }).data).toEqual({
      code: '4821',
    })
  })

  it('rejects anything that is not exactly four digits', () => {
    for (const code of ['482', '48210', '48a1', '', '12 34']) {
      expect(advanceOrderInputSchema.safeParse({ code }).success).toBe(false)
    }
  })
})
