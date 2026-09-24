// Everything the customer's live map shows, derived in one pure pass from
// the last fix, the route and the promised ETA. The component only ticks a
// clock and feeds this; the tests exercise the reasoning.
import { haversineKm, type LatLng } from '@/lib/geo'
import type { RealtimeStatus } from '@/lib/realtime/status'
import {
  delayStatus,
  liveEta,
  signalStatus,
  type DelayStatus,
  type SignalStatus,
} from '@/lib/tracking/eta'
import {
  projectOntoRoute,
  remainingRouteKm,
  splitRoute,
} from '@/lib/tracking/route-progress'

/**
 * A fix further than this from the nearest point of the route is a detour,
 * not GPS noise: the marker stays where the courier really is instead of
 * snapping onto a street they are not on.
 */
export const OFF_ROUTE_KM = 0.15

/** No realtime event for this long, while one is expected, and we poll. */
export const POLL_AFTER_SILENCE_MS = 20_000
/** Poll cadence once the fallback is on. */
export const POLL_INTERVAL_MS = 10_000

export interface CourierTrackingInput {
  /** Last raw GPS fix, or null before the first one. */
  raw: LatLng | null
  /** Route as LatLng vertices (already flipped from `[lng, lat]`). */
  route: LatLng[]
  /** Where the route ends; used only when there is no route to measure. */
  destination?: LatLng | null
  updatedAt: Date | string | null
  estimatedAt: Date | string | null
  now?: Date
}

export interface CourierTrackingView {
  /** Point to draw the courier at: snapped onto the route, or raw off it. */
  point: LatLng | null
  offRoute: boolean
  /** Travelled part of the route, ending at `point`. */
  done: LatLng[]
  /** Remaining part of the route, starting at `point`. */
  ahead: LatLng[]
  /** Route distance still ahead, or null when nothing can be measured. */
  remainingKm: number | null
  /** ETA recomputed from `remainingKm`; null without a distance. */
  eta: Date | null
  /** How the promised ETA is holding up; null when none was promised. */
  delay: DelayStatus | null
  signal: SignalStatus
}

export function courierTrackingView({
  raw,
  route,
  destination = null,
  updatedAt,
  estimatedAt,
  now = new Date(),
}: CourierTrackingInput): CourierTrackingView {
  const signal = signalStatus({ updatedAt, now })
  const delay = estimatedAt ? delayStatus({ estimatedAt, now }) : null

  if (!raw) {
    return {
      point: null,
      offRoute: false,
      done: [],
      ahead: route,
      remainingKm: null,
      eta: null,
      delay,
      signal,
    }
  }

  if (route.length < 2) {
    const remainingKm = destination ? haversineKm(raw, destination) : null
    return {
      point: raw,
      offRoute: false,
      done: [],
      ahead: [],
      remainingKm,
      eta: remainingKm === null ? null : liveEta({ remainingKm, now }),
      delay,
      signal,
    }
  }

  const progress = projectOntoRoute(raw, route)
  const offRoute = progress.offsetKm > OFF_ROUTE_KM
  const point = offRoute ? raw : progress.point
  const { done, ahead } = splitRoute(route, progress.index, progress.point)
  // Off the route the courier still has to get back to it.
  const remainingKm =
    remainingRouteKm(progress, route) + (offRoute ? progress.offsetKm : 0)

  return {
    point,
    offRoute,
    done,
    // Off the route the remaining line starts where the courier is and
    // rejoins the street at the projection.
    ahead: offRoute ? [raw, ...ahead] : ahead,
    remainingKm,
    eta: liveEta({ remainingKm, now }),
    delay,
    signal,
  }
}

export interface PollFallbackInput {
  realtimeStatus: RealtimeStatus
  /** True while the courier is on the way and fixes should keep coming. */
  expectLive: boolean
  /** Epoch ms of the last realtime event, or null when none arrived yet. */
  lastEventAt: number | null
  /** Epoch ms the subscription started; the silence counts from here. */
  mountedAt?: number
  now: number
  silenceMs?: number
}

/**
 * Whether to fall back to polling the server for the courier position: the
 * shared channel dropped, or a courier who should be moving has been silent
 * for longer than the grace period.
 */
export function shouldPollFallback({
  realtimeStatus,
  expectLive,
  lastEventAt,
  mountedAt,
  now,
  silenceMs = POLL_AFTER_SILENCE_MS,
}: PollFallbackInput): boolean {
  if (realtimeStatus === 'disconnected') return true
  if (!expectLive) return false
  const since = lastEventAt ?? mountedAt ?? now
  return now - since >= silenceMs
}
