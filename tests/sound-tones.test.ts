import { describe, expect, it } from 'vitest'
import {
  ATTACK_S,
  MIN_GAP_MS,
  NOTE,
  NOTE_GAP_S,
  TONE_GAIN,
  scheduleTones,
  shouldPlayNow,
  toneSequenceFor,
  type AudioContextLike,
  type SoundEvent,
  type ToneStep,
} from '@/lib/sound/tones'
import { ORDER_STATUS_SEQUENCE } from '@/lib/orders/status'

const EVENTS: SoundEvent[] = [
  'new_order',
  'pending',
  'accepted',
  'preparing',
  'ready',
  'picked_up',
  'delivered',
  'cancelled',
]

const MAX_FREQ_HZ = 1100
const MAX_STEP_S = 0.4
const MAX_TOTAL_S = 0.8

function totalLength(steps: ToneStep[]): number {
  return steps.reduce((end, step) => Math.max(end, step.at + step.duration), 0)
}

describe('toneSequenceFor', () => {
  it('never sounds for a pending order', () => {
    expect(toneSequenceFor('pending')).toEqual([])
  })

  it('has a sequence for every other event', () => {
    for (const event of EVENTS.filter((event) => event !== 'pending')) {
      expect(toneSequenceFor(event).length, event).toBeGreaterThan(0)
    }
  })

  it('covers every order status', () => {
    for (const status of ORDER_STATUS_SEQUENCE) {
      expect(Array.isArray(toneSequenceFor(status))).toBe(true)
    }
    expect(Array.isArray(toneSequenceFor('cancelled'))).toBe(true)
  })

  it('stays low and short on every event', () => {
    for (const event of EVENTS) {
      const steps = toneSequenceFor(event)
      for (const step of steps) {
        expect(step.freq, event).toBeLessThanOrEqual(MAX_FREQ_HZ)
        expect(step.duration, event).toBeLessThanOrEqual(MAX_STEP_S)
        expect(step.duration, event).toBeGreaterThan(0)
        // An attack longer than the note would schedule the release ramp
        // before the attack ramp ends.
        expect(step.duration, event).toBeGreaterThan(ATTACK_S)
        expect(step.at, event).toBeGreaterThanOrEqual(0)
      }
      expect(totalLength(steps), event).toBeLessThanOrEqual(MAX_TOTAL_S)
    }
  })

  it('schedules the steps in non-decreasing order', () => {
    for (const event of EVENTS) {
      const ats = toneSequenceFor(event).map((step) => step.at)
      for (let index = 1; index < ats.length; index += 1) {
        expect(ats[index], event).toBeGreaterThanOrEqual(ats[index - 1])
      }
    }
  })

  it('only uses pentatonic notes', () => {
    const allowed = new Set<number>(Object.values(NOTE))
    for (const event of EVENTS) {
      for (const step of toneSequenceFor(event)) {
        expect(allowed.has(step.freq), `${event} ${step.freq}`).toBe(true)
      }
    }
  })

  it('rings the merchant ding-dong for a new order', () => {
    expect(NOTE_GAP_S).toBe(0.16)
    expect(toneSequenceFor('new_order')).toEqual([
      { freq: NOTE.C5, at: 0, duration: 0.28 },
      { freq: NOTE.E5, at: NOTE_GAP_S, duration: 0.28 },
    ])
  })

  it('rises through the progress statuses', () => {
    expect(toneSequenceFor('accepted').map((step) => step.freq)).toEqual([
      NOTE.C5,
      NOTE.E5,
    ])
    expect(toneSequenceFor('preparing')).toEqual([
      { freq: NOTE.E5, at: 0, duration: 0.32 },
    ])
    expect(toneSequenceFor('ready')).toEqual([
      { freq: NOTE.C5, at: 0, duration: 0.26 },
      { freq: NOTE.E5, at: 0.14, duration: 0.26 },
      { freq: NOTE.G5, at: 0.28, duration: 0.26 },
    ])
    expect(toneSequenceFor('picked_up').map((step) => step.freq)).toEqual([
      NOTE.E5,
      NOTE.G5,
    ])
  })

  it('resolves upward on delivery', () => {
    const steps = toneSequenceFor('delivered')
    expect(steps.map((step) => step.freq)).toEqual([NOTE.G5, NOTE.C6])
    for (const step of steps) expect(step.duration).toBe(0.34)
  })

  it('descends on cancellation', () => {
    const steps = toneSequenceFor('cancelled')
    expect(steps.map((step) => step.freq)).toEqual([NOTE.E5, NOTE.C5])
    for (let index = 1; index < steps.length; index += 1) {
      expect(steps[index].freq).toBeLessThan(steps[index - 1].freq)
    }
    for (const step of steps) expect(step.duration).toBe(0.3)
  })
})

describe('TONE_GAIN', () => {
  it('is softer than the old 0.2 chime', () => {
    expect(TONE_GAIN).toBe(0.12)
    expect(TONE_GAIN).toBeLessThan(0.2)
    expect(ATTACK_S).toBe(0.03)
  })
})

describe('shouldPlayNow', () => {
  it('plays the first event', () => {
    expect(shouldPlayNow(null, 1_000)).toBe(true)
  })

  it('keeps one tone from stacking on the previous one', () => {
    expect(MIN_GAP_MS).toBe(500)
    expect(shouldPlayNow(1_000, 1_000)).toBe(false)
    expect(shouldPlayNow(1_000, 1_000 + MIN_GAP_MS - 1)).toBe(false)
  })

  it('plays again once the gap has passed', () => {
    expect(shouldPlayNow(1_000, 1_000 + MIN_GAP_MS)).toBe(true)
    expect(shouldPlayNow(1_000, 5_000)).toBe(true)
  })

  it('honours a custom gap', () => {
    expect(shouldPlayNow(1_000, 1_100, 200)).toBe(false)
    expect(shouldPlayNow(1_000, 1_200, 200)).toBe(true)
  })
})

interface ParamCall {
  method: 'setValueAtTime' | 'exponentialRampToValueAtTime'
  value: number
  time: number
}

interface FakeOscillator {
  type: string
  frequencyValue: number
  connectedTo: unknown[]
  started: number | null
  stopped: number | null
}

interface FakeGain {
  calls: ParamCall[]
  connectedTo: unknown[]
}

function fakeContext(currentTime = 10) {
  const oscillators: FakeOscillator[] = []
  const gains: FakeGain[] = []
  const destination = { connect: () => destination }
  const ctx: AudioContextLike = {
    currentTime,
    destination,
    createOscillator() {
      const record: FakeOscillator = {
        type: '',
        frequencyValue: 0,
        connectedTo: [],
        started: null,
        stopped: null,
      }
      oscillators.push(record)
      return {
        get type() {
          return record.type
        },
        set type(value: string) {
          record.type = value
        },
        frequency: {
          get value() {
            return record.frequencyValue
          },
          set value(value: number) {
            record.frequencyValue = value
          },
          setValueAtTime: () => undefined,
          exponentialRampToValueAtTime: () => undefined,
        },
        connect(node) {
          record.connectedTo.push(node)
          return node
        },
        start(time: number) {
          record.started = time
        },
        stop(time: number) {
          record.stopped = time
        },
      }
    },
    createGain() {
      const record: FakeGain = { calls: [], connectedTo: [] }
      gains.push(record)
      return {
        gain: {
          value: 1,
          setValueAtTime(value: number, time: number) {
            record.calls.push({ method: 'setValueAtTime', value, time })
          },
          exponentialRampToValueAtTime(value: number, time: number) {
            record.calls.push({
              method: 'exponentialRampToValueAtTime',
              value,
              time,
            })
          },
        },
        connect(node) {
          record.connectedTo.push(node)
          return node
        },
      }
    },
  }
  return { ctx, oscillators, gains, destination }
}

describe('scheduleTones', () => {
  const steps: ToneStep[] = [
    { freq: NOTE.C5, at: 0, duration: 0.28 },
    { freq: NOTE.E5, at: 0.16, duration: 0.28 },
  ]

  it('creates one sine oscillator per step at the requested pitch', () => {
    const { ctx, oscillators } = fakeContext()
    scheduleTones(ctx, steps, ctx.currentTime)
    expect(oscillators).toHaveLength(2)
    expect(oscillators.map((osc) => osc.type)).toEqual(['sine', 'sine'])
    expect(oscillators.map((osc) => osc.frequencyValue)).toEqual([
      NOTE.C5,
      NOTE.E5,
    ])
  })

  it('starts and stops each oscillator relative to now', () => {
    const { ctx, oscillators } = fakeContext(10)
    scheduleTones(ctx, steps, 10)
    expect(oscillators[0].started).toBeCloseTo(10)
    expect(oscillators[0].stopped).toBeCloseTo(10.28)
    expect(oscillators[1].started).toBeCloseTo(10.16)
    expect(oscillators[1].stopped).toBeCloseTo(10.44)
  })

  it('shapes the gain with a soft attack and an exponential release', () => {
    const { ctx, gains } = fakeContext(10)
    scheduleTones(ctx, steps, 10)
    expect(gains).toHaveLength(2)
    const [first] = gains
    expect(first.calls).toHaveLength(3)
    expect(first.calls[0]).toEqual({
      method: 'setValueAtTime',
      value: 0.0001,
      time: 10,
    })
    expect(first.calls[1].method).toBe('exponentialRampToValueAtTime')
    expect(first.calls[1].value).toBe(TONE_GAIN)
    expect(first.calls[1].time).toBeCloseTo(10 + ATTACK_S)
    expect(first.calls[2].method).toBe('exponentialRampToValueAtTime')
    expect(first.calls[2].value).toBe(0.0001)
    expect(first.calls[2].time).toBeCloseTo(10.28)
  })

  it('wires oscillator -> gain -> destination', () => {
    const { ctx, oscillators, gains, destination } = fakeContext()
    scheduleTones(ctx, steps, ctx.currentTime)
    expect(oscillators[0].connectedTo).toHaveLength(1)
    expect(gains[0].connectedTo).toEqual([destination])
  })

  it('returns the time the sequence ends and touches nothing when empty', () => {
    const { ctx, oscillators } = fakeContext(5)
    expect(scheduleTones(ctx, [], 5)).toBe(5)
    expect(oscillators).toHaveLength(0)
    expect(scheduleTones(ctx, steps, 5)).toBeCloseTo(5.44)
  })
})
