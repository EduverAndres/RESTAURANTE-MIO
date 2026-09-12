// Address search and reverse geocoding on top of OpenStreetMap Nominatim.
// Safe to call from the browser (Nominatim allows CORS). Usage policy: keep
// requests debounced and identify the application.
import type { LatLng } from '@/lib/geo'

const NOMINATIM = 'https://nominatim.openstreetmap.org'

export interface GeocodeResult extends LatLng {
  label: string
  /** Short street-level line for the address form. */
  line1: string
}

interface NominatimPlace {
  lat: string
  lon: string
  display_name: string
  address?: Record<string, string | undefined>
}

function toResult(place: NominatimPlace): GeocodeResult {
  const address = place.address ?? {}
  const street = [address.road, address.house_number].filter(Boolean).join(' ')
  const line1 =
    street || address.neighbourhood || address.suburb || place.display_name
  return {
    lat: Number(place.lat),
    lng: Number(place.lon),
    label: place.display_name,
    line1: line1.slice(0, 120),
  }
}

async function request(
  path: string,
  signal?: AbortSignal,
): Promise<NominatimPlace[] | NominatimPlace | null> {
  const response = await fetch(`${NOMINATIM}${path}`, {
    signal,
    headers: { Accept: 'application/json', 'Accept-Language': 'es' },
  })
  if (!response.ok) return null
  return (await response.json()) as NominatimPlace[] | NominatimPlace
}

export async function searchAddress(
  query: string,
  options: { signal?: AbortSignal; near?: LatLng } = {},
): Promise<GeocodeResult[]> {
  const trimmed = query.trim()
  if (trimmed.length < 3) return []
  const params = new URLSearchParams({
    q: trimmed,
    format: 'jsonv2',
    addressdetails: '1',
    limit: '6',
    countrycodes: 'co',
  })
  if (options.near) {
    const { lat, lng } = options.near
    params.set('viewbox', `${lng - 0.3},${lat + 0.3},${lng + 0.3},${lat - 0.3}`)
  }
  const data = await request(`/search?${params.toString()}`, options.signal)
  return Array.isArray(data) ? data.map(toResult) : []
}

export async function reverseGeocode(
  point: LatLng,
  signal?: AbortSignal,
): Promise<GeocodeResult | null> {
  const params = new URLSearchParams({
    lat: String(point.lat),
    lon: String(point.lng),
    format: 'jsonv2',
    addressdetails: '1',
    zoom: '18',
  })
  const data = await request(`/reverse?${params.toString()}`, signal)
  if (!data || Array.isArray(data) || !data.lat) return null
  return toResult(data)
}
