import { describe, expect, it } from 'vitest'
import { COURIER_SPEED_KMH, HANDOVER_BUFFER_MIN } from '@/lib/geo'
import {
  delayLabel,
  delayStatus,
  isStalled,
  liveEta,
  signalLabel,
  signalStatus,
} from '@/lib/tracking/eta'

const MIN = 60_000
const now = new Date(2026, 0, 1, 12, 0, 0)

describe('liveEta', () => {
  it('adds travel time at the default speed plus the handover buffer, rounded up', () => {
    // 2 km at 20 km/h = 6 min, + 5 = 11 min.
    expect(COURIER_SPEED_KMH).toBe(20)
    expect(HANDOVER_BUFFER_MIN).toBe(5)
    const eta = liveEta({ remainingKm: 2, now })
    expect(eta.getTime() - now.getTime()).toBe(11 * MIN)
  })

  it('accepts a custom speed and buffer', () => {
    const eta = liveEta({ remainingKm: 10, speedKmh: 30, handoverMin: 0, now })
    expect(eta.getTime() - now.getTime()).toBe(20 * MIN)
  })

  it('treats NaN, negative distance or a zero speed as no travel', () => {
    expect(liveEta({ remainingKm: -3, now }).getTime() - now.getTime()).toBe(
      HANDOVER_BUFFER_MIN * MIN,
    )
    expect(
      liveEta({ remainingKm: Number.NaN, now }).getTime() - now.getTime(),
    ).toBe(HANDOVER_BUFFER_MIN * MIN)
    expect(
      liveEta({ remainingKm: 2, speedKmh: 0, now }).getTime() - now.getTime(),
    ).toBe(HANDOVER_BUFFER_MIN * MIN)
  })
})

describe('delayStatus', () => {
  it('is on time while more than two minutes remain', () => {
    expect(
      delayStatus({ estimatedAt: new Date(now.getTime() + 10 * MIN), now }),
    ).toEqual({ kind: 'on_time', minutes: 10 })
  })

  it('is arriving in the last two minutes', () => {
    expect(
      delayStatus({ estimatedAt: new Date(now.getTime() + 2 * MIN), now }),
    ).toEqual({ kind: 'arriving', minutes: 2 })
    expect(
      delayStatus({ estimatedAt: new Date(now.getTime() + 30_000), now }),
    ).toEqual({ kind: 'arriving', minutes: 1 })
    expect(delayStatus({ estimatedAt: now, now })).toEqual({
      kind: 'arriving',
      minutes: 0,
    })
  })

  it('is late once the ETA has passed, by at least one minute', () => {
    expect(
      delayStatus({ estimatedAt: new Date(now.getTime() - 10_000), now }),
    ).toEqual({ kind: 'late', minutes: 1 })
    expect(
      delayStatus({ estimatedAt: new Date(now.getTime() - 7.5 * MIN), now }),
    ).toEqual({ kind: 'late', minutes: 8 })
  })

  it('accepts ISO strings', () => {
    expect(
      delayStatus({
        estimatedAt: new Date(now.getTime() + 5 * MIN).toISOString(),
        now,
      }),
    ).toEqual({ kind: 'on_time', minutes: 5 })
  })
})

describe('delayLabel', () => {
  it('speaks Spanish', () => {
    expect(delayLabel({ kind: 'on_time', minutes: 10 })).toBe('A tiempo')
    expect(delayLabel({ kind: 'arriving', minutes: 1 })).toBe('Llegando')
    expect(delayLabel({ kind: 'late', minutes: 4 })).toBe(
      'Con retraso de 4 min',
    )
  })
})

describe('signalStatus', () => {
  it('is live under 30 seconds', () => {
    expect(
      signalStatus({ updatedAt: new Date(now.getTime() - 12_000), now }),
    ).toEqual({ kind: 'live', seconds: 12 })
    expect(signalStatus({ updatedAt: now, now })).toEqual({
      kind: 'live',
      seconds: 0,
    })
  })

  it('is stale between 30 and 120 seconds', () => {
    expect(
      signalStatus({ updatedAt: new Date(now.getTime() - 30_000), now }),
    ).toEqual({ kind: 'stale', seconds: 30 })
    expect(
      signalStatus({ updatedAt: new Date(now.getTime() - 120_000), now }),
    ).toEqual({ kind: 'stale', seconds: 120 })
  })

  it('is lost after 120 seconds', () => {
    expect(
      signalStatus({ updatedAt: new Date(now.getTime() - 121_000), now }),
    ).toEqual({ kind: 'lost', seconds: 121 })
  })

  it('accepts ISO strings and clamps clock skew to zero', () => {
    expect(
      signalStatus({
        updatedAt: new Date(now.getTime() + 5_000).toISOString(),
        now,
      }),
    ).toEqual({ kind: 'live', seconds: 0 })
  })

  it('treats a missing or invalid timestamp as lost', () => {
    expect(signalStatus({ updatedAt: null, now }).kind).toBe('lost')
    expect(signalStatus({ updatedAt: 'nope', now }).kind).toBe('lost')
  })
})

describe('signalLabel', () => {
  it('speaks Spanish for the three states', () => {
    expect(signalLabel({ kind: 'live', seconds: 4 })).toBe('En vivo · hace 4 s')
    expect(signalLabel({ kind: 'stale', seconds: 45 })).toBe(
      'Sin señal hace 45 s',
    )
    expect(signalLabel({ kind: 'lost', seconds: 121 })).toBe(
      'Sin señal hace 2 min',
    )
    expect(signalLabel({ kind: 'lost', seconds: 600 })).toBe(
      'Sin señal hace 10 min',
    )
  })
})

describe('isStalled', () => {
  const base = { lat: 4.65, lng: -74.08 }
  // ~100 m east.
  const moved = { lat: 4.65, lng: -74.0791 }
  // ~5 m east: GPS jitter.
  const jitter = { lat: 4.65, lng: -74.079955 }

  it('is false without enough history to cover the window', () => {
    expect(
      isStalled({
        positions: [{ at: new Date(now.getTime() - 3 * MIN), point: base }],
        now,
      }),
    ).toBe(false)
    expect(isStalled({ positions: [], now })).toBe(false)
  })

  it('is true when every fix in the window stays within the jitter radius', () => {
    expect(
      isStalled({
        positions: [
          { at: new Date(now.getTime() - 6 * MIN), point: base },
          { at: new Date(now.getTime() - 4 * MIN), point: jitter },
          { at: new Date(now.getTime() - 1 * MIN), point: base },
        ],
        now,
      }),
    ).toBe(true)
  })

  it('is false as soon as one fix moved farther than the threshold', () => {
    expect(
      isStalled({
        positions: [
          { at: new Date(now.getTime() - 6 * MIN), point: base },
          { at: new Date(now.getTime() - 2 * MIN), point: moved },
        ],
        now,
      }),
    ).toBe(false)
  })

  it('only looks at the window: older movement does not count', () => {
    expect(
      isStalled({
        positions: [
          { at: new Date(now.getTime() - 20 * MIN), point: moved },
          { at: new Date(now.getTime() - 6 * MIN), point: base },
          { at: new Date(now.getTime() - 1 * MIN), point: jitter },
        ],
        now,
      }),
    ).toBe(true)
  })

  it('honours custom window and radius', () => {
    const positions = [
      { at: new Date(now.getTime() - 3 * MIN), point: base },
      { at: new Date(now.getTime() - 1 * MIN), point: jitter },
    ]
    expect(isStalled({ positions, now, minutes: 2 })).toBe(true)
    expect(isStalled({ positions, now, minutes: 2, meters: 2 })).toBe(false)
  })
})
