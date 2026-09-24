import { describe, expect, it } from 'vitest'
import {
  OFF_ROUTE_KM,
  POLL_AFTER_SILENCE_MS,
  courierTrackingView,
  shouldPollFallback,
} from '@/lib/tracking/live-view'

// A straight east-west route of three vertices, ~1.1 km per segment.
const ROUTE = [
  { lat: 4.65, lng: -74.08 },
  { lat: 4.65, lng: -74.07 },
  { lat: 4.65, lng: -74.06 },
]
const NOW = new Date('2026-09-23T15:00:00Z')

describe('courierTrackingView', () => {
  it('projects the fix onto the route and splits travelled from remaining', () => {
    const view = courierTrackingView({
      raw: { lat: 4.6502, lng: -74.075 },
      route: ROUTE,
      updatedAt: new Date(NOW.getTime() - 5_000),
      estimatedAt: null,
      now: NOW,
    })
    expect(view.point?.lat).toBeCloseTo(4.65, 6)
    expect(view.point?.lng).toBeCloseTo(-74.075, 6)
    expect(view.offRoute).toBe(false)
    expect(view.done).toHaveLength(2)
    expect(view.ahead).toHaveLength(3)
    expect(view.remainingKm).not.toBeNull()
    expect(view.remainingKm!).toBeGreaterThan(1.6)
    expect(view.remainingKm!).toBeLessThan(1.7)
    expect(view.signal).toEqual({ kind: 'live', seconds: 5 })
  })

  it('derives the live ETA from the remaining route distance', () => {
    const view = courierTrackingView({
      raw: { lat: 4.65, lng: -74.065 },
      route: ROUTE,
      updatedAt: NOW,
      estimatedAt: null,
      now: NOW,
    })
    // ~0.55 km at 20 km/h is under 2 min, plus the 5 min handover buffer.
    const minutes = (view.eta!.getTime() - NOW.getTime()) / 60_000
    expect(minutes).toBeGreaterThan(6)
    expect(minutes).toBeLessThan(7.5)
  })

  it('keeps the raw point and flags it when the courier is far off the route', () => {
    const raw = { lat: 4.68, lng: -74.075 }
    const view = courierTrackingView({
      raw,
      route: ROUTE,
      updatedAt: NOW,
      estimatedAt: null,
      now: NOW,
    })
    expect(view.offRoute).toBe(true)
    expect(view.point).toEqual(raw)
    // Off the route, what is left is the detour back plus the route ahead.
    expect(view.remainingKm!).toBeGreaterThan(OFF_ROUTE_KM + 1.6)
  })

  it('reads the delay from the promised ETA, not the live one', () => {
    const view = courierTrackingView({
      raw: { lat: 4.65, lng: -74.075 },
      route: ROUTE,
      updatedAt: NOW,
      estimatedAt: new Date(NOW.getTime() - 4 * 60_000),
      now: NOW,
    })
    expect(view.delay).toEqual({ kind: 'late', minutes: 4 })
  })

  it('has no delay reading without a promised ETA', () => {
    const view = courierTrackingView({
      raw: { lat: 4.65, lng: -74.075 },
      route: ROUTE,
      updatedAt: NOW,
      estimatedAt: null,
      now: NOW,
    })
    expect(view.delay).toBeNull()
  })

  it('reports a lost signal and the whole route ahead before the first fix', () => {
    const view = courierTrackingView({
      raw: null,
      route: ROUTE,
      updatedAt: null,
      estimatedAt: null,
      now: NOW,
    })
    expect(view.point).toBeNull()
    expect(view.signal.kind).toBe('lost')
    expect(view.done).toEqual([])
    expect(view.ahead).toEqual(ROUTE)
    expect(view.remainingKm).toBeNull()
    expect(view.eta).toBeNull()
  })

  it('falls back to a straight line when there is no route but a destination', () => {
    const view = courierTrackingView({
      raw: { lat: 4.65, lng: -74.08 },
      route: [],
      destination: { lat: 4.65, lng: -74.07 },
      updatedAt: NOW,
      estimatedAt: null,
      now: NOW,
    })
    expect(view.point).toEqual({ lat: 4.65, lng: -74.08 })
    expect(view.remainingKm!).toBeGreaterThan(1)
    expect(view.remainingKm!).toBeLessThan(1.2)
    expect(view.done).toEqual([])
    expect(view.ahead).toEqual([])
  })
})

describe('shouldPollFallback', () => {
  const base = {
    realtimeStatus: 'connected' as const,
    expectLive: true,
    lastEventAt: NOW.getTime() - 1_000,
    now: NOW.getTime(),
  }

  it('polls when the shared channel reports a drop', () => {
    expect(
      shouldPollFallback({ ...base, realtimeStatus: 'disconnected' }),
    ).toBe(true)
  })

  it('polls when a live courier has been silent for the grace period', () => {
    expect(
      shouldPollFallback({
        ...base,
        lastEventAt: NOW.getTime() - POLL_AFTER_SILENCE_MS,
      }),
    ).toBe(true)
    expect(
      shouldPollFallback({
        ...base,
        lastEventAt: NOW.getTime() - POLL_AFTER_SILENCE_MS + 1,
      }),
    ).toBe(false)
  })

  it('counts the silence from mount when no event has arrived yet', () => {
    expect(
      shouldPollFallback({
        ...base,
        lastEventAt: null,
        mountedAt: NOW.getTime() - 30_000,
      }),
    ).toBe(true)
    expect(
      shouldPollFallback({
        ...base,
        lastEventAt: null,
        mountedAt: NOW.getTime(),
      }),
    ).toBe(false)
  })

  it('never polls while the courier is not expected to be moving, unless disconnected', () => {
    expect(
      shouldPollFallback({
        ...base,
        expectLive: false,
        lastEventAt: NOW.getTime() - 60_000,
      }),
    ).toBe(false)
    expect(
      shouldPollFallback({
        ...base,
        expectLive: false,
        realtimeStatus: 'disconnected',
      }),
    ).toBe(true)
  })
})
