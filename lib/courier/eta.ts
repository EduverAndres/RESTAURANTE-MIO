// Pure helpers for the courier flow: ETA arithmetic, position throttling and
// heading. No DOM, no network, so they run on the server, in the browser
// (geolocation publisher) and in tests.
import { HANDOVER_BUFFER_MIN, haversineKm, type LatLng } from '@/lib/geo'

const MS_PER_MIN = 60_000

export interface EtaFromRouteInput {
  /** Travel time reported by the routing provider. */
  durationMin: number
  /** Handover buffer (pickup + doorstep). Defaults to the shared constant. */
  bufferMin?: number
  /** Injectable clock for tests. */
  now?: Date
}

/** Arrival time = now + travel + buffer, rounded up to whole minutes. */
export function etaFromRoute({
  durationMin,
  bufferMin = HANDOVER_BUFFER_MIN,
  now = new Date(),
}: EtaFromRouteInput): Date {
  const travel = Number.isFinite(durationMin) ? Math.max(0, durationMin) : 0
  const buffer = Number.isFinite(bufferMin) ? Math.max(0, bufferMin) : 0
  const minutes = Math.ceil(travel + buffer)
  return new Date(now.getTime() + minutes * MS_PER_MIN)
}

const etaFormatter = new Intl.DateTimeFormat('es-CO', {
  hour: '2-digit',
  minute: '2-digit',
  hourCycle: 'h23',
})

/** "19:05" style clock time; null when the input is missing or invalid. */
export function formatEta(
  value: Date | string | null | undefined,
): string | null {
  if (value === null || value === undefined) return null
  const date = value instanceof Date ? value : new Date(value)
  if (Number.isNaN(date.getTime())) return null
  return etaFormatter.format(date)
}

// Customer-facing pages show a 12-hour clock ("10:31 p. m."); the courier
// pages keep the 24-hour one above. Same guards as formatEta.
const clockFormatter = new Intl.DateTimeFormat('es-CO', {
  hour: '2-digit',
  minute: '2-digit',
})

export function formatClock(
  value: Date | string | null | undefined,
): string | null {
  if (value === null || value === undefined) return null
  const date = value instanceof Date ? value : new Date(value)
  if (Number.isNaN(date.getTime())) return null
  return clockFormatter.format(date)
}

export interface TimedPosition extends LatLng {
  /** Epoch milliseconds when the fix was taken. */
  at: number
}

export interface PublishThrottle {
  /** Minimum movement before a new fix is worth sending. */
  minMeters: number
  /** Minimum time between two sends. */
  minMs: number
}

/**
 * Decides whether a geolocation fix should be sent to the server. The first
 * fix always goes out; afterwards the courier must have moved at least
 * `minMeters` and at least `minMs` must have elapsed, which filters GPS
 * jitter and caps the write rate.
 */
export function shouldPublishPosition(
  prev: TimedPosition | null,
  next: TimedPosition,
  { minMeters, minMs }: PublishThrottle,
): boolean {
  if (!prev) return true
  if (next.at - prev.at < minMs) return false
  const meters = haversineKm(prev, next) * 1000
  return meters >= minMeters
}

function toRadians(degrees: number): number {
  return (degrees * Math.PI) / 180
}

function toDegrees(radians: number): number {
  return (radians * 180) / Math.PI
}

/** Initial bearing from prev to next in degrees [0, 360); null if equal. */
export function compassHeading(prev: LatLng, next: LatLng): number | null {
  if (prev.lat === next.lat && prev.lng === next.lng) return null
  const lat1 = toRadians(prev.lat)
  const lat2 = toRadians(next.lat)
  const dLng = toRadians(next.lng - prev.lng)
  const y = Math.sin(dLng) * Math.cos(lat2)
  const x =
    Math.cos(lat1) * Math.sin(lat2) -
    Math.sin(lat1) * Math.cos(lat2) * Math.cos(dLng)
  return (toDegrees(Math.atan2(y, x)) + 360) % 360
}
