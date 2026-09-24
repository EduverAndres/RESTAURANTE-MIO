import { describe, expect, it } from 'vitest'
import { haversineKm } from '@/lib/geo'
import {
  projectOntoRoute,
  remainingRouteKm,
  routeFromGeometry,
  routeLengthKm,
  splitRoute,
  toGeometry,
} from '@/lib/tracking/route-progress'

// A simple L-shaped route in Bogotá: ~1 km east, then ~1 km north.
const A = { lat: 4.65, lng: -74.08 }
const B = { lat: 4.65, lng: -74.071 }
const C = { lat: 4.659, lng: -74.071 }
const ROUTE = [A, B, C]

describe('routeFromGeometry', () => {
  it('flips [lng, lat] pairs into LatLng points', () => {
    expect(
      routeFromGeometry([
        [-74.08, 4.65],
        [-74.071, 4.65],
      ]),
    ).toEqual([A, B])
  })

  it('returns an empty route for empty geometry', () => {
    expect(routeFromGeometry([])).toEqual([])
  })
})

describe('toGeometry', () => {
  it('is the inverse of routeFromGeometry', () => {
    const geometry: [number, number][] = [
      [-74.08, 4.65],
      [-74.071, 4.65],
    ]
    expect(toGeometry(routeFromGeometry(geometry))).toEqual(geometry)
    expect(toGeometry([])).toEqual([])
  })
})

describe('routeLengthKm', () => {
  it('sums every segment', () => {
    const expected = haversineKm(A, B) + haversineKm(B, C)
    expect(routeLengthKm(ROUTE)).toBeCloseTo(expected, 9)
  })

  it('is zero for fewer than two points', () => {
    expect(routeLengthKm([])).toBe(0)
    expect(routeLengthKm([A])).toBe(0)
  })
})

describe('projectOntoRoute', () => {
  it('snaps a point slightly off the first segment onto it', () => {
    // ~30 m north of the midpoint of A-B.
    const raw = { lat: 4.65027, lng: -74.0755 }
    const progress = projectOntoRoute(raw, ROUTE)
    expect(progress.index).toBe(0)
    expect(progress.point.lat).toBeCloseTo(4.65, 6)
    expect(progress.point.lng).toBeCloseTo(-74.0755, 6)
    expect(progress.offsetKm * 1000).toBeGreaterThan(25)
    expect(progress.offsetKm * 1000).toBeLessThan(35)
    expect(progress.distanceAlongKm).toBeCloseTo(haversineKm(A, B) / 2, 3)
  })

  it('picks the closest segment, not the first', () => {
    // ~20 m east of the midpoint of B-C.
    const raw = { lat: 4.6545, lng: -74.07082 }
    const progress = projectOntoRoute(raw, ROUTE)
    expect(progress.index).toBe(1)
    expect(progress.point.lng).toBeCloseTo(-74.071, 6)
    expect(progress.point.lat).toBeCloseTo(4.6545, 6)
    expect(progress.distanceAlongKm).toBeCloseTo(
      haversineKm(A, B) + haversineKm(B, C) / 2,
      3,
    )
  })

  it('clamps to the segment ends when the point is beyond them', () => {
    const beforeStart = { lat: 4.65, lng: -74.09 }
    const start = projectOntoRoute(beforeStart, ROUTE)
    expect(start.point).toEqual(A)
    expect(start.distanceAlongKm).toBe(0)
    expect(start.offsetKm).toBeCloseTo(haversineKm(beforeStart, A), 9)

    const pastEnd = { lat: 4.67, lng: -74.071 }
    const end = projectOntoRoute(pastEnd, ROUTE)
    expect(end.point).toEqual(C)
    expect(end.index).toBe(1)
    expect(end.distanceAlongKm).toBeCloseTo(routeLengthKm(ROUTE), 9)
  })

  it('returns the point itself for an empty route and the only point for a single-point route', () => {
    const raw = { lat: 4.6, lng: -74.1 }
    expect(projectOntoRoute(raw, [])).toEqual({
      point: raw,
      index: 0,
      distanceAlongKm: 0,
      offsetKm: 0,
    })
    const single = projectOntoRoute(raw, [A])
    expect(single.point).toEqual(A)
    expect(single.index).toBe(0)
    expect(single.distanceAlongKm).toBe(0)
    expect(single.offsetKm).toBeCloseTo(haversineKm(raw, A), 9)
  })

  it('ignores a zero-length segment without dividing by zero', () => {
    const progress = projectOntoRoute({ lat: 4.65, lng: -74.075 }, [A, A, B])
    expect(Number.isFinite(progress.distanceAlongKm)).toBe(true)
    expect(progress.point.lng).toBeCloseTo(-74.075, 6)
  })
})

describe('remainingRouteKm', () => {
  it('is the total length minus the distance travelled', () => {
    const progress = projectOntoRoute(B, ROUTE)
    expect(remainingRouteKm(progress, ROUTE)).toBeCloseTo(haversineKm(B, C), 6)
  })

  it('never goes negative', () => {
    const progress = projectOntoRoute(C, ROUTE)
    expect(remainingRouteKm(progress, ROUTE)).toBeGreaterThanOrEqual(0)
    expect(remainingRouteKm(progress, ROUTE)).toBeCloseTo(0, 9)
  })
})

describe('splitRoute', () => {
  it('splits at the projected point so both halves meet there', () => {
    const mid = { lat: 4.65, lng: -74.0755 }
    const { done, ahead } = splitRoute(ROUTE, 0, mid)
    expect(done).toEqual([A, mid])
    expect(ahead).toEqual([mid, B, C])
  })

  it('keeps every earlier vertex in the travelled part', () => {
    const mid = { lat: 4.6545, lng: -74.071 }
    const { done, ahead } = splitRoute(ROUTE, 1, mid)
    expect(done).toEqual([A, B, mid])
    expect(ahead).toEqual([mid, C])
  })

  it('handles an empty route', () => {
    expect(splitRoute([], 0, A)).toEqual({ done: [], ahead: [] })
  })
})
