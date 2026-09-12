import { describe, expect, it } from 'vitest'
import {
  compassHeading,
  etaFromRoute,
  formatEta,
  shouldPublishPosition,
} from '@/lib/courier/eta'

describe('etaFromRoute', () => {
  const now = new Date(2026, 0, 1, 12, 0, 0)

  it('adds travel minutes and the handover buffer, rounding up', () => {
    const eta = etaFromRoute({ durationMin: 12.2, bufferMin: 5, now })
    expect(eta.getTime() - now.getTime()).toBe(18 * 60_000)
  })

  it('defaults the buffer to the shared handover constant', () => {
    const eta = etaFromRoute({ durationMin: 10, now })
    expect(eta.getTime() - now.getTime()).toBe(15 * 60_000)
  })

  it('never returns a time before now for negative or NaN input', () => {
    expect(
      etaFromRoute({ durationMin: -30, bufferMin: 0, now }).getTime(),
    ).toBe(now.getTime())
    expect(
      etaFromRoute({ durationMin: Number.NaN, bufferMin: 5, now }).getTime(),
    ).toBe(now.getTime() + 5 * 60_000)
  })
})

describe('formatEta', () => {
  it('formats as a 24h clock time', () => {
    expect(formatEta(new Date(2026, 0, 1, 19, 5))).toBe('19:05')
    expect(formatEta(new Date(2026, 0, 1, 0, 30))).toBe('00:30')
  })

  it('accepts ISO strings and returns null for invalid input', () => {
    expect(formatEta(new Date(2026, 0, 1, 8, 15).toISOString())).toBe('08:15')
    expect(formatEta(null)).toBeNull()
    expect(formatEta('nope')).toBeNull()
  })
})

describe('shouldPublishPosition', () => {
  const options = { minMeters: 15, minMs: 4000 }
  const origin = { lat: 4.65, lng: -74.08, at: 10_000 }

  it('always publishes the first fix', () => {
    expect(shouldPublishPosition(null, origin, options)).toBe(true)
  })

  it('rejects fixes that arrive too soon', () => {
    const next = { lat: 4.66, lng: -74.08, at: 12_000 }
    expect(shouldPublishPosition(origin, next, options)).toBe(false)
  })

  it('rejects jitter below the distance threshold', () => {
    // ~5 m north
    const next = { lat: 4.650045, lng: -74.08, at: 20_000 }
    expect(shouldPublishPosition(origin, next, options)).toBe(false)
  })

  it('publishes when both time and distance thresholds are met', () => {
    // ~22 m north
    const next = { lat: 4.6502, lng: -74.08, at: 14_000 }
    expect(shouldPublishPosition(origin, next, options)).toBe(true)
  })
})

describe('compassHeading', () => {
  const origin = { lat: 4.65, lng: -74.08 }

  it('returns cardinal bearings in degrees', () => {
    expect(compassHeading(origin, { lat: 4.66, lng: -74.08 })).toBeCloseTo(0, 0)
    expect(compassHeading(origin, { lat: 4.65, lng: -74.07 })).toBeCloseTo(
      90,
      0,
    )
    expect(compassHeading(origin, { lat: 4.64, lng: -74.08 })).toBeCloseTo(
      180,
      0,
    )
    expect(compassHeading(origin, { lat: 4.65, lng: -74.09 })).toBeCloseTo(
      270,
      0,
    )
  })

  it('returns null when the points coincide', () => {
    expect(compassHeading(origin, origin)).toBeNull()
  })
})
