// Geographic helpers. Pure and dependency-free so they run on the server,
// in the browser and in tests.
import type { OrderType } from '@/types/app'

export interface LatLng {
  lat: number
  lng: number
}

/**
 * Default map centre when the visitor has not shared a location: Barranquilla,
 * the pilot city (OSM centroid). Named for what it is so a future city change
 * is one constant, not a rename.
 */
export const DEFAULT_MAP_CENTER: LatLng = { lat: 11.0102, lng: -74.8232 }

const EARTH_RADIUS_KM = 6371
/** Average urban courier speed used for time estimates. */
export const COURIER_SPEED_KMH = 20
/** Fixed handover buffer (packing, pickup, doorstep). */
export const HANDOVER_BUFFER_MIN = 5

function toRadians(degrees: number): number {
  return (degrees * Math.PI) / 180
}

export function haversineKm(a: LatLng, b: LatLng): number {
  const dLat = toRadians(b.lat - a.lat)
  const dLng = toRadians(b.lng - a.lng)
  const lat1 = toRadians(a.lat)
  const lat2 = toRadians(b.lat)
  const h =
    Math.sin(dLat / 2) ** 2 +
    Math.cos(lat1) * Math.cos(lat2) * Math.sin(dLng / 2) ** 2
  return 2 * EARTH_RADIUS_KM * Math.asin(Math.sqrt(h))
}

export interface EtaInput {
  distanceKm: number
  prepTimeMin: number
  type?: OrderType
}

export function estimateEtaMinutes({
  distanceKm,
  prepTimeMin,
  type = 'delivery',
}: EtaInput): number {
  const travel = type === 'delivery' ? (distanceKm / COURIER_SPEED_KMH) * 60 : 0
  return Math.ceil(prepTimeMin + travel + HANDOVER_BUFFER_MIN)
}

export function isWithinRadius(distanceKm: number, radiusKm: number): boolean {
  return distanceKm <= radiusKm
}

export function formatDistance(km: number): string {
  if (km < 1) return `${Math.round(km * 1000)} m`
  return `${km.toFixed(1).replace('.', ',')} km`
}

export function isLatLng(value: unknown): value is LatLng {
  return (
    typeof value === 'object' &&
    value !== null &&
    typeof (value as LatLng).lat === 'number' &&
    typeof (value as LatLng).lng === 'number' &&
    Math.abs((value as LatLng).lat) <= 90 &&
    Math.abs((value as LatLng).lng) <= 180
  )
}

/** Builds a point from nullable database columns; null when either is missing. */
export function latLngOf(
  row: { lat: number | null; lng: number | null } | null | undefined,
): LatLng | null {
  if (!row || typeof row.lat !== 'number' || typeof row.lng !== 'number')
    return null
  return { lat: row.lat, lng: row.lng }
}
