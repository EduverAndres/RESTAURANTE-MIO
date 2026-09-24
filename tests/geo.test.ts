import { describe, expect, it } from 'vitest'
import {
  DEFAULT_MAP_CENTER,
  estimateEtaMinutes,
  formatDistance,
  haversineKm,
  isWithinRadius,
} from '@/lib/geo'

describe('DEFAULT_MAP_CENTER', () => {
  // The pilot is Barranquilla. A visitor who has not shared a location must
  // see a map centred there, not on Bogotá -- and the constant must say so
  // in its name rather than hide a Barranquilla point under BOGOTA_CENTER.
  it('is Barranquilla', () => {
    expect(DEFAULT_MAP_CENTER.lat).toBeCloseTo(11.01, 1)
    expect(DEFAULT_MAP_CENTER.lng).toBeCloseTo(-74.82, 1)
  })
})

describe('haversineKm', () => {
  it('returns 0 for the same point', () => {
    expect(haversineKm(DEFAULT_MAP_CENTER, DEFAULT_MAP_CENTER)).toBe(0)
  })

  it('measures the distance between two Bogotá points within tolerance', () => {
    // Parque de la 93 to Plaza de Bolívar is roughly 8.6 km.
    const km = haversineKm(
      { lat: 4.6766, lng: -74.0483 },
      { lat: 4.5981, lng: -74.0758 },
    )
    expect(km).toBeGreaterThan(8)
    expect(km).toBeLessThan(9.5)
  })
})

describe('estimateEtaMinutes', () => {
  it('adds prep time, travel time at courier speed and a handover buffer', () => {
    // 5 km at 20 km/h = 15 min, + 20 prep + 5 buffer = 40
    expect(estimateEtaMinutes({ distanceKm: 5, prepTimeMin: 20 })).toBe(40)
  })

  it('uses only prep time plus buffer for pickup', () => {
    expect(
      estimateEtaMinutes({ distanceKm: 5, prepTimeMin: 20, type: 'pickup' }),
    ).toBe(25)
  })

  it('rounds up to whole minutes', () => {
    expect(estimateEtaMinutes({ distanceKm: 1, prepTimeMin: 10 })).toBe(18)
  })
})

describe('isWithinRadius', () => {
  it('compares distance with the store radius', () => {
    expect(isWithinRadius(4.9, 5)).toBe(true)
    expect(isWithinRadius(5.1, 5)).toBe(false)
  })
})

describe('formatDistance', () => {
  it('shows metres under 1 km and one decimal above', () => {
    expect(formatDistance(0.45)).toBe('450 m')
    expect(formatDistance(2.345)).toBe('2,3 km')
  })
})

describe('latLngOf', () => {
  it('returns a point only when both coordinates are numbers', async () => {
    const { latLngOf } = await import('@/lib/geo')
    expect(latLngOf({ lat: 4.6, lng: -74.1 })).toEqual({ lat: 4.6, lng: -74.1 })
    expect(latLngOf({ lat: null, lng: -74.1 })).toBeNull()
    expect(latLngOf({ lat: 4.6, lng: null })).toBeNull()
    expect(latLngOf(null)).toBeNull()
    expect(latLngOf(undefined)).toBeNull()
  })
})
