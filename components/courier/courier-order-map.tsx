'use client'

import { RouteIcon } from 'lucide-react'
import { useMemo } from 'react'
import { getOwnPosition } from '@/app/courier/actions'
import { LocationMapLazy } from '@/components/map/location-map-lazy'
import type { MapMarker } from '@/components/map/location-map'
import { useNow } from '@/components/map/use-now'
import {
  useCourierPosition,
  type CourierFix,
} from '@/components/orders/use-courier-position'
import { formatEta } from '@/lib/courier/eta'
import { BOGOTA_CENTER, formatDistance, type LatLng } from '@/lib/geo'
import { signalLabel } from '@/lib/tracking/eta'
import { courierTrackingView } from '@/lib/tracking/live-view'
import { routeFromGeometry, toGeometry } from '@/lib/tracking/route-progress'
import type { OrderStatus } from '@/types/app'

interface CourierOrderMapProps {
  /** The signed-in courier: their own row in courier_locations is followed. */
  courierId: string
  status: OrderStatus
  store: LatLng | null
  customer: LatLng | null
  /** Last fix the server rendered; the publisher keeps it fresh from here. */
  initialCourier: CourierFix | null
  /** [lng, lat] pairs of the server-computed route. */
  path: [number, number][]
  routeKm: number | null
  routeMin: number | null
}

/**
 * Map of store, customer and the courier's own position with the route
 * drawn between them. The courier never sees a code here: the map is the
 * same one the customer gets, minus anything secret.
 *
 * The ETA shown en route is recomputed from the live position and the clock,
 * not the minutes the server estimated at pickup: a courier stuck in traffic
 * for ten minutes must see the estimate move.
 */
export function CourierOrderMap({
  courierId,
  status,
  store,
  customer,
  initialCourier,
  path,
  routeKm,
  routeMin,
}: CourierOrderMapProps) {
  const enRoute = status === 'picked_up'
  const fix = useCourierPosition({
    courierId,
    initial: initialCourier,
    expectLive: enRoute,
    poll: getOwnPosition,
  })
  const now = useNow(true)
  const route = useMemo(() => routeFromGeometry(path), [path])

  const view = useMemo(
    () =>
      courierTrackingView({
        raw: fix ? { lat: fix.lat, lng: fix.lng } : null,
        route: enRoute ? route : [],
        destination: customer,
        updatedAt: fix?.updatedAt ?? null,
        estimatedAt: null,
        now,
      }),
    [customer, enRoute, fix, now, route],
  )
  const signal = view.signal

  const markers: MapMarker[] = []
  if (store)
    markers.push({ id: 'store', kind: 'store', label: 'Restaurante', ...store })
  if (customer)
    markers.push({
      id: 'customer',
      kind: 'customer',
      label: 'Cliente',
      ...customer,
    })
  if (fix && view.point)
    markers.push({
      id: 'courier',
      kind: 'courier',
      label: 'Tú',
      ...view.point,
      heading: fix.heading,
      live: signal.kind === 'live',
      muted: signal.kind === 'lost',
      accuracyM: fix.accuracyM,
    })

  const points = markers.map(({ lat, lng }) => ({ lat, lng }))
  if (points.length === 0) {
    return (
      <p className="rounded-card bg-muted/60 text-muted-foreground p-4 text-sm">
        Sin coordenadas para mostrar el mapa de este pedido.
      </p>
    )
  }

  const split = enRoute && route.length > 1
  const ahead = split ? toGeometry(view.ahead) : path
  const done = split ? toGeometry(view.done) : []
  const remainingKm = split ? view.remainingKm : routeKm
  const etaClock = split && view.eta ? formatEta(view.eta) : null

  return (
    <div className="space-y-2">
      <LocationMapLazy
        center={points[0] ?? BOGOTA_CENTER}
        markers={markers}
        path={ahead}
        pathDone={done}
        fitTo={points}
        className="rounded-card h-[60vh] max-h-[520px] min-h-72 w-full overflow-hidden md:h-96"
      />
      <div className="text-muted-foreground flex flex-wrap items-center gap-x-3 gap-y-1 text-xs">
        {remainingKm !== null ? (
          <p className="flex items-center gap-1.5">
            <RouteIcon aria-hidden="true" className="size-3.5" />
            {formatDistance(remainingKm)}
            {etaClock
              ? ` · llegas ~${etaClock}`
              : routeMin !== null
                ? ` · unos ${Math.max(1, Math.round(routeMin))} min en moto`
                : null}
          </p>
        ) : null}
        {fix ? <p>{signalLabel(signal)}</p> : null}
      </div>
    </div>
  )
}
