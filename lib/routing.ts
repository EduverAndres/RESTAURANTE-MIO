// Distance and travel-time estimation behind a swappable provider.
// Server-only usage is recommended (API keys); the haversine fallback needs
// no network and keeps checkout working when the routing service is down.
import { estimateEtaMinutes, haversineKm, type LatLng } from '@/lib/geo'

export interface RouteEstimate {
  distanceKm: number
  durationMin: number
  /** [lng, lat] pairs when the provider returns a geometry; empty otherwise. */
  geometry: [number, number][]
  provider: 'osrm' | 'ors' | 'haversine'
}

export interface RoutingProvider {
  readonly name: RouteEstimate['provider']
  route(from: LatLng, to: LatLng, signal?: AbortSignal): Promise<RouteEstimate>
}

const REQUEST_TIMEOUT_MS = 4000

export const haversineProvider: RoutingProvider = {
  name: 'haversine',
  async route(from, to) {
    // Straight-line distance inflated by a street-grid factor.
    const distanceKm = haversineKm(from, to) * 1.3
    return {
      distanceKm,
      durationMin: estimateEtaMinutes({ distanceKm, prepTimeMin: 0 }) - 5,
      geometry: [
        [from.lng, from.lat],
        [to.lng, to.lat],
      ],
      provider: 'haversine',
    }
  },
}

interface OsrmResponse {
  code: string
  routes?: {
    distance: number
    duration: number
    geometry?: { coordinates: [number, number][] }
  }[]
}

export function createOsrmProvider(
  baseUrl = process.env.OSRM_BASE_URL ?? 'https://router.project-osrm.org',
): RoutingProvider {
  return {
    name: 'osrm',
    async route(from, to, signal) {
      const url = `${baseUrl}/route/v1/driving/${from.lng},${from.lat};${to.lng},${to.lat}?overview=simplified&geometries=geojson`
      const response = await fetch(url, { signal, next: { revalidate: 0 } })
      if (!response.ok) throw new Error(`OSRM responded ${response.status}`)
      const data = (await response.json()) as OsrmResponse
      const route = data.routes?.[0]
      if (data.code !== 'Ok' || !route)
        throw new Error('OSRM returned no route')
      return {
        distanceKm: route.distance / 1000,
        durationMin: route.duration / 60,
        geometry: route.geometry?.coordinates ?? [],
        provider: 'osrm',
      }
    },
  }
}

interface OrsResponse {
  features?: {
    properties: { summary: { distance: number; duration: number } }
    geometry: { coordinates: [number, number][] }
  }[]
}

export function createOrsProvider(apiKey: string): RoutingProvider {
  return {
    name: 'ors',
    async route(from, to, signal) {
      const response = await fetch(
        'https://api.openrouteservice.org/v2/directions/driving-car/geojson',
        {
          method: 'POST',
          signal,
          headers: {
            'Content-Type': 'application/json',
            Authorization: apiKey,
          },
          body: JSON.stringify({
            coordinates: [
              [from.lng, from.lat],
              [to.lng, to.lat],
            ],
          }),
        },
      )
      if (!response.ok) throw new Error(`ORS responded ${response.status}`)
      const data = (await response.json()) as OrsResponse
      const feature = data.features?.[0]
      if (!feature) throw new Error('ORS returned no route')
      return {
        distanceKm: feature.properties.summary.distance / 1000,
        durationMin: feature.properties.summary.duration / 60,
        geometry: feature.geometry.coordinates,
        provider: 'ors',
      }
    },
  }
}

export function getRoutingProvider(): RoutingProvider {
  const configured = process.env.ROUTING_PROVIDER ?? 'osrm'
  if (configured === 'ors' && process.env.ORS_API_KEY) {
    return createOrsProvider(process.env.ORS_API_KEY)
  }
  if (configured === 'haversine') return haversineProvider
  return createOsrmProvider()
}

/** Routes with the configured provider and falls back to haversine on failure. */
export async function estimateRoute(
  from: LatLng,
  to: LatLng,
): Promise<RouteEstimate> {
  const provider = getRoutingProvider()
  if (provider.name === 'haversine') return provider.route(from, to)

  const controller = new AbortController()
  const timer = setTimeout(() => controller.abort(), REQUEST_TIMEOUT_MS)
  try {
    return await provider.route(from, to, controller.signal)
  } catch (error) {
    console.warn(
      `Routing provider ${provider.name} failed, using haversine`,
      error,
    )
    return haversineProvider.route(from, to)
  } finally {
    clearTimeout(timer)
  }
}
