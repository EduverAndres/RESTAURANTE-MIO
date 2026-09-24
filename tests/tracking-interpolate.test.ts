import { describe, expect, it } from 'vitest'
import { compassHeading } from '@/lib/courier/eta'
import { bearingDeg, easeOut, interpolate } from '@/lib/tracking/interpolate'

const from = { lat: 4.65, lng: -74.08 }
const to = { lat: 4.66, lng: -74.07 }

describe('interpolate', () => {
  it('returns the endpoints at t = 0 and t = 1', () => {
    expect(interpolate(from, to, 0)).toEqual(from)
    expect(interpolate(from, to, 1)).toEqual(to)
  })

  it('moves linearly in between', () => {
    const half = interpolate(from, to, 0.5)
    expect(half.lat).toBeCloseTo(4.655, 9)
    expect(half.lng).toBeCloseTo(-74.075, 9)
    const quarter = interpolate(from, to, 0.25)
    expect(quarter.lat).toBeCloseTo(4.6525, 9)
    expect(quarter.lng).toBeCloseTo(-74.0775, 9)
  })

  it('clamps t outside [0, 1] and treats NaN as the end', () => {
    expect(interpolate(from, to, -1)).toEqual(from)
    expect(interpolate(from, to, 3)).toEqual(to)
    expect(interpolate(from, to, Number.NaN)).toEqual(to)
  })
})

describe('easeOut', () => {
  it('starts at 0, ends at 1 and decelerates', () => {
    expect(easeOut(0)).toBe(0)
    expect(easeOut(1)).toBe(1)
    expect(easeOut(0.5)).toBeGreaterThan(0.5)
    expect(easeOut(2)).toBe(1)
    expect(easeOut(-1)).toBe(0)
  })
})

describe('bearingDeg', () => {
  it('reuses the courier compass heading', () => {
    expect(bearingDeg(from, to)).toBe(compassHeading(from, to))
    expect(bearingDeg(from, { lat: 4.66, lng: -74.08 })).toBeCloseTo(0, 6)
    expect(bearingDeg(from, { lat: 4.65, lng: -74.07 })).toBeCloseTo(90, 3)
  })

  it('is null when the points coincide', () => {
    expect(bearingDeg(from, from)).toBeNull()
  })
})
