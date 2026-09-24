// Status-change tones.
//
// Pure module: which notes each event plays, and how they are scheduled on a
// Web Audio graph. It takes a minimal context interface so tests can record
// the graph with a fake; the browser-only `AudioContext` lifecycle lives in
// `./player.ts`.
//
// The vocabulary is deliberately small and low-arousal: a pentatonic handful
// of notes below 1.1 kHz, every sequence under a second, sine waves with a
// soft attack. The product ask is "not stressful", so nothing here beeps.
import type { OrderStatus } from '@/types/app'

export type SoundEvent = OrderStatus | 'new_order'

/** One note: pitch in Hz, offset and length in seconds. */
export interface ToneStep {
  freq: number
  at: number
  duration: number
}

export const NOTE = {
  C5: 523.25,
  D5: 587.33,
  E5: 659.25,
  G5: 783.99,
  A5: 880,
  C6: 1046.5,
} as const

/** Peak gain; softer than the old 0.2 chime. */
export const TONE_GAIN = 0.12
/** Attack length in seconds, so a tone fades in rather than clicks. */
export const ATTACK_S = 0.03

/**
 * Offset of a pair's second note, in seconds: it overlaps the first so the
 * two read as one gesture rather than two beeps.
 */
export const NOTE_GAP_S = 0.16

/**
 * Minimum time between two played events, in milliseconds. A resync backfill
 * can replay several status updates at once, and stacked voices clip.
 */
export const MIN_GAP_MS = 500

/** Gain floor for the exponential ramps (they cannot reach zero). */
const SILENT = 0.0001

/**
 * Burst guard: whether an event at `now` may play given when the last one
 * was accepted (`lastAt`, `null` when nothing has played yet). Both are
 * epoch milliseconds.
 */
export function shouldPlayNow(
  lastAt: number | null,
  now: number,
  minGapMs = MIN_GAP_MS,
): boolean {
  return lastAt === null || now - lastAt >= minGapMs
}

function pair(
  first: number,
  second: number,
  duration: number,
  gap = NOTE_GAP_S,
): ToneStep[] {
  return [
    { freq: first, at: 0, duration },
    { freq: second, at: gap, duration },
  ]
}

const SEQUENCES: Record<SoundEvent, ToneStep[]> = {
  // The order has not been acknowledged by anyone yet: nothing to celebrate.
  pending: [],
  // The merchant's "ding-dong".
  new_order: pair(NOTE.C5, NOTE.E5, 0.28),
  accepted: pair(NOTE.C5, NOTE.E5, 0.28),
  preparing: [{ freq: NOTE.E5, at: 0, duration: 0.32 }],
  ready: [
    { freq: NOTE.C5, at: 0, duration: 0.26 },
    { freq: NOTE.E5, at: 0.14, duration: 0.26 },
    { freq: NOTE.G5, at: 0.28, duration: 0.26 },
  ],
  picked_up: pair(NOTE.E5, NOTE.G5, 0.28),
  // The resolve.
  delivered: pair(NOTE.G5, NOTE.C6, 0.34),
  // Descending, so the ear reads it as "no" without alarm.
  cancelled: pair(NOTE.E5, NOTE.C5, 0.3),
}

export function toneSequenceFor(event: SoundEvent): ToneStep[] {
  return SEQUENCES[event].map((step) => ({ ...step }))
}

// The slice of the Web Audio API the scheduler touches. A real
// `AudioContext` satisfies it structurally.
export interface AudioParamLike {
  value: number
  setValueAtTime(value: number, time: number): unknown
  exponentialRampToValueAtTime(value: number, time: number): unknown
}

export interface AudioNodeLike {
  connect(destination: AudioNodeLike): AudioNodeLike
}

export interface OscillatorLike extends AudioNodeLike {
  type: string
  frequency: AudioParamLike
  start(time: number): void
  stop(time: number): void
}

export interface GainLike extends AudioNodeLike {
  gain: AudioParamLike
}

export interface AudioContextLike {
  currentTime: number
  destination: AudioNodeLike
  createOscillator(): OscillatorLike
  createGain(): GainLike
}

/**
 * Schedules `steps` on `ctx` starting at `now` (context seconds). Each step is
 * a sine oscillator through its own gain node: silent, up to `TONE_GAIN` over
 * `ATTACK_S`, then an exponential release that lands back at silence exactly
 * when the note stops. Returns the context time at which the last note ends.
 */
export function scheduleTones(
  ctx: AudioContextLike,
  steps: readonly ToneStep[],
  now: number,
): number {
  let end = now
  for (const step of steps) {
    const start = now + step.at
    const stop = start + step.duration
    const oscillator = ctx.createOscillator()
    const gain = ctx.createGain()
    oscillator.type = 'sine'
    oscillator.frequency.value = step.freq
    gain.gain.setValueAtTime(SILENT, start)
    gain.gain.exponentialRampToValueAtTime(TONE_GAIN, start + ATTACK_S)
    gain.gain.exponentialRampToValueAtTime(SILENT, stop)
    oscillator.connect(gain).connect(ctx.destination)
    oscillator.start(start)
    oscillator.stop(stop)
    end = Math.max(end, stop)
  }
  return end
}
