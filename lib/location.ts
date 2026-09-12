// The visitor's chosen location is kept in a cookie so server components can
// rank stores by distance without a client round-trip. Pure helpers.
import { isLatLng, type LatLng } from '@/lib/geo'

export const LOCATION_COOKIE = 'tienda_location'
export const LOCATION_COOKIE_MAX_AGE = 60 * 60 * 24 * 90

export interface VisitorLocation extends LatLng {
  label: string
}

export function serializeLocation(location: VisitorLocation): string {
  return encodeURIComponent(
    JSON.stringify({
      lat: Number(location.lat.toFixed(6)),
      lng: Number(location.lng.toFixed(6)),
      label: location.label.slice(0, 120),
    }),
  )
}

export function parseLocation(
  raw: string | null | undefined,
): VisitorLocation | null {
  if (!raw) return null
  try {
    const value: unknown = JSON.parse(decodeURIComponent(raw))
    if (!isLatLng(value)) return null
    const rawLabel = (value as unknown as { label?: unknown }).label
    const label = typeof rawLabel === 'string' ? rawLabel : ''
    return { lat: value.lat, lng: value.lng, label }
  } catch {
    return null
  }
}
