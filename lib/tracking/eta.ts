// Live-tracking arithmetic: rolling ETA, delay against the promised time,
// signal freshness and "has the courier stopped moving". Pure and clock-
// injectable so the one-second ticker in the browser and the tests share it.
import {
  COURIER_SPEED_KMH,
  HANDOVER_BUFFER_MIN,
  haversineKm,
  type LatLng,
} from '@/lib/geo'

const MS_PER_MIN = 60_000
const MS_PER_SEC = 1_000

/** Last two minutes before the ETA read as "arriving" rather than a countdown. */
export const ARRIVING_WINDOW_MIN = 2
/** A fix younger than this is live. */
export const SIGNAL_LIVE_MAX_S = 30
/** Older than this and the courier is out of contact. */
export const SIGNAL_LOST_AFTER_S = 120

function toDate(value: Date | string | null | undefined): Date | null {
  if (value === null || value === undefined) return null
  const date = value instanceof Date ? value : new Date(value)
  return Number.isNaN(date.getTime()) ? null : date
}

export interface LiveEtaInput {
  /** Route distance still ahead of the courier. */
  remainingKm: number
  speedKmh?: number
  handoverMin?: number
  now?: Date
}

/** Arrival = now + remaining distance at courier speed + doorstep buffer. */
export function liveEta({
  remainingKm,
  speedKmh = COURIER_SPEED_KMH,
  handoverMin = HANDOVER_BUFFER_MIN,
  now = new Date(),
}: LiveEtaInput): Date {
  const km = Number.isFinite(remainingKm) ? Math.max(0, remainingKm) : 0
  const speed = Number.isFinite(speedKmh) && speedKmh > 0 ? speedKmh : 0
  const travel = speed > 0 ? (km / speed) * 60 : 0
  const buffer = Number.isFinite(handoverMin) ? Math.max(0, handoverMin) : 0
  const minutes = Math.ceil(travel + buffer)
  return new Date(now.getTime() + minutes * MS_PER_MIN)
}

export type DelayKind = 'on_time' | 'arriving' | 'late'

export interface DelayStatus {
  kind: DelayKind
  /** Minutes remaining (on_time/arriving) or minutes late (late, >= 1). */
  minutes: number
}

export interface DelayStatusInput {
  estimatedAt: Date | string
  now?: Date
}

export function delayStatus({
  estimatedAt,
  now = new Date(),
}: DelayStatusInput): DelayStatus {
  const eta = toDate(estimatedAt)
  if (!eta) return { kind: 'on_time', minutes: 0 }
  const diffMin = (eta.getTime() - now.getTime()) / MS_PER_MIN
  if (diffMin < 0)
    return { kind: 'late', minutes: Math.max(1, Math.ceil(-diffMin)) }
  const minutes = Math.ceil(diffMin)
  if (diffMin <= ARRIVING_WINDOW_MIN) return { kind: 'arriving', minutes }
  return { kind: 'on_time', minutes }
}

export function delayLabel(status: DelayStatus): string {
  switch (status.kind) {
    case 'on_time':
      return 'A tiempo'
    case 'arriving':
      return 'Llegando'
    case 'late':
      return `Con retraso de ${status.minutes} min`
  }
}

export type SignalKind = 'live' | 'stale' | 'lost'

export interface SignalStatus {
  kind: SignalKind
  /** Whole seconds since the last fix; 0 when the clock reads ahead. */
  seconds: number
}

export interface SignalStatusInput {
  updatedAt: Date | string | null | undefined
  now?: Date
}

export function signalStatus({
  updatedAt,
  now = new Date(),
}: SignalStatusInput): SignalStatus {
  const at = toDate(updatedAt)
  if (!at) return { kind: 'lost', seconds: Number.POSITIVE_INFINITY }
  const seconds = Math.max(
    0,
    Math.floor((now.getTime() - at.getTime()) / MS_PER_SEC),
  )
  if (seconds < SIGNAL_LIVE_MAX_S) return { kind: 'live', seconds }
  if (seconds <= SIGNAL_LOST_AFTER_S) return { kind: 'stale', seconds }
  return { kind: 'lost', seconds }
}

export function signalLabel(status: SignalStatus): string {
  switch (status.kind) {
    case 'live':
      return `En vivo · hace ${status.seconds} s`
    case 'stale':
      return `Sin señal hace ${status.seconds} s`
    case 'lost': {
      if (!Number.isFinite(status.seconds)) return 'Sin señal'
      const minutes = Math.max(1, Math.floor(status.seconds / 60))
      return `Sin señal hace ${minutes} min`
    }
  }
}

export interface TimedPoint {
  at: Date
  point: LatLng
}

export interface StalledInput {
  positions: TimedPoint[]
  now?: Date
  /** Window to look back over. */
  minutes?: number
  /** Movement below this is GPS jitter, not travel. */
  meters?: number
}

/**
 * True when the courier has not moved more than `meters` from where they
 * were at the start of the window. Needs a fix at or before the window
 * start to say so; with less history the answer is "not known", i.e. false.
 */
export function isStalled({
  positions,
  now = new Date(),
  minutes = 5,
  meters = 25,
}: StalledInput): boolean {
  const windowStart = now.getTime() - minutes * MS_PER_MIN
  let reference: TimedPoint | null = null
  for (const sample of positions) {
    const at = sample.at.getTime()
    if (at <= windowStart && (!reference || at > reference.at.getTime())) {
      reference = sample
    }
  }
  if (!reference) return false
  const referenceAt = reference.at.getTime()
  for (const sample of positions) {
    if (sample.at.getTime() <= referenceAt) continue
    if (haversineKm(reference.point, sample.point) * 1000 > meters) return false
  }
  return true
}
