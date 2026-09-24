// Where along a route a raw GPS point is. Pure: no DOM, no network, so the
// same maths runs in the browser (marker snapping, remaining distance) and
// in tests.
//
// A route is an ordered polyline of LatLng vertices. Projecting a point onto
// it means finding the closest point on any segment; the segment index and
// the distance travelled along the route fall out of the same pass.
import { haversineKm, type LatLng } from '@/lib/geo'

export interface RouteProgress {
  /** Closest point on the route. */
  point: LatLng
  /** Index of the segment the point lies on (`route[index]` -> `route[index + 1]`). */
  index: number
  /** Route distance from the start to `point`. */
  distanceAlongKm: number
  /** Straight-line distance from the raw point to `point`. */
  offsetKm: number
}

/** Routing providers hand back `[lng, lat]` pairs; the map wants LatLng. */
export function routeFromGeometry(geometry: [number, number][]): LatLng[] {
  return geometry.map(([lng, lat]) => ({ lat, lng }))
}

export function routeLengthKm(route: LatLng[]): number {
  let total = 0
  for (let i = 1; i < route.length; i += 1) {
    total += haversineKm(route[i - 1]!, route[i]!)
  }
  return total
}

/**
 * Local planar coordinates (in degrees, longitude scaled by the cosine of
 * the latitude). Over the few kilometres of a delivery this is accurate to
 * well under a metre and keeps the projection a dot product.
 */
function toPlane(point: LatLng, cosLat: number): [number, number] {
  return [point.lng * cosLat, point.lat]
}

/**
 * Nearest point on the route to `point`. With no route the point is its own
 * projection; with a single vertex every point projects onto it.
 */
export function projectOntoRoute(
  point: LatLng,
  route: LatLng[],
): RouteProgress {
  if (route.length === 0) {
    return { point, index: 0, distanceAlongKm: 0, offsetKm: 0 }
  }
  if (route.length === 1) {
    const only = route[0]!
    return {
      point: only,
      index: 0,
      distanceAlongKm: 0,
      offsetKm: haversineKm(point, only),
    }
  }

  const cosLat = Math.cos((point.lat * Math.PI) / 180)
  const [px, py] = toPlane(point, cosLat)

  let best: RouteProgress | null = null
  let bestPlanar = Number.POSITIVE_INFINITY
  let along = 0

  for (let i = 0; i < route.length - 1; i += 1) {
    const a = route[i]!
    const b = route[i + 1]!
    const [ax, ay] = toPlane(a, cosLat)
    const [bx, by] = toPlane(b, cosLat)
    const dx = bx - ax
    const dy = by - ay
    const lengthSq = dx * dx + dy * dy
    // A zero-length segment cannot be projected onto; its start is the only
    // candidate, and `t = 0` covers it without dividing by zero.
    const t =
      lengthSq === 0
        ? 0
        : Math.min(1, Math.max(0, ((px - ax) * dx + (py - ay) * dy) / lengthSq))
    const candidate: LatLng =
      t === 0
        ? a
        : t === 1
          ? b
          : {
              lat: a.lat + (b.lat - a.lat) * t,
              lng: a.lng + (b.lng - a.lng) * t,
            }
    const cx = ax + dx * t
    const cy = ay + dy * t
    const planar = (px - cx) ** 2 + (py - cy) ** 2
    if (planar < bestPlanar) {
      bestPlanar = planar
      best = {
        point: candidate,
        index: i,
        distanceAlongKm: along + haversineKm(a, candidate),
        offsetKm: haversineKm(point, candidate),
      }
    }
    along += haversineKm(a, b)
  }

  return best!
}

/** Route distance still ahead of the projected point; never negative. */
export function remainingRouteKm(
  progress: Pick<RouteProgress, 'distanceAlongKm'>,
  route: LatLng[],
): number {
  return Math.max(0, routeLengthKm(route) - progress.distanceAlongKm)
}

/**
 * Splits the route at the projected point: `done` runs from the start to it,
 * `ahead` from it to the end, both including the point so the two lines meet.
 */
export function splitRoute(
  route: LatLng[],
  index: number,
  point: LatLng,
): { done: LatLng[]; ahead: LatLng[] } {
  if (route.length === 0) return { done: [], ahead: [] }
  const at = Math.min(Math.max(0, index), route.length - 1)
  return {
    done: [...route.slice(0, at + 1), point],
    ahead: [point, ...route.slice(at + 1)],
  }
}
