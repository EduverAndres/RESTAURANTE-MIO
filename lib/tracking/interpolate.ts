// Marker animation maths: where a marker should be `t` of the way between
// two fixes, and which way it should point. Pure so the requestAnimationFrame
// loop in the map stays a thin wrapper.
import { compassHeading } from '@/lib/courier/eta'
import type { LatLng } from '@/lib/geo'

function clamp01(t: number): number {
  if (Number.isNaN(t)) return 1
  return Math.min(1, Math.max(0, t))
}

/** Linear blend from `from` to `to`; `t` is clamped to [0, 1]. */
export function interpolate(from: LatLng, to: LatLng, t: number): LatLng {
  const k = clamp01(t)
  if (k === 0) return from
  if (k === 1) return to
  return {
    lat: from.lat + (to.lat - from.lat) * k,
    lng: from.lng + (to.lng - from.lng) * k,
  }
}

/** Cubic ease-out: fast start, gentle landing on the new fix. */
export function easeOut(t: number): number {
  const k = clamp01(t)
  return 1 - (1 - k) ** 3
}

/** Initial bearing in degrees [0, 360), or null when the points coincide. */
export function bearingDeg(from: LatLng, to: LatLng): number | null {
  return compassHeading(from, to)
}
