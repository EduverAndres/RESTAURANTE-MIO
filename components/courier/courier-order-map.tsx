'use client'

import { RouteIcon } from 'lucide-react'
import { useMemo } from 'react'
import { LocationMapLazy } from '@/components/map/location-map-lazy'
import type { MapMarker } from '@/components/map/location-map'
import {
  useCourierPosition,
  type CourierFix,
} from '@/components/orders/use-courier-position'
import { BOGOTA_CENTER, formatDistance, type LatLng } from '@/lib/geo'
import { signalLabel, signalStatus } from '@/lib/tracking/eta'
import { courierTrackingView } from '@/lib/tracking/live-view'
import { routeFromGeometry } from '@/lib/tracking/route-progress'
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

function toGeometry(points: LatLng[]): [number, number][] {
  return points.map(({ lat, lng }) => [lng, lat] as [number, number])
}

/**
 * Map of store, customer and the courier's own position with the route
 * drawn between them. The courier never sees a code here: the map is the
 * same one the customer gets, minus anything secret.
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
  })
  const route = useMemo(() => routeFromGeometry(path), [path])
  const signal = signalStatus({ updatedAt: fix?.updatedAt ?? null })

  const view = useMemo(
    () =>
      courierTrackingView({
        raw: fix ? { lat: fix.lat, lng: fix.lng } : null,
        route: enRoute ? route : [],
        destination: customer,
        updatedAt: fix?.updatedAt ?? null,
        estimatedAt: null,
      }),
    [customer, enRoute, fix, route],
  )

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
        {remainingKm !== null && routeMin !== null ? (
          <p className="flex items-center gap-1.5">
            <RouteIcon aria-hidden="true" className="size-3.5" />
            {formatDistance(remainingKm)} · unos{' '}
            {Math.max(1, Math.round(routeMin))} min en moto
          </p>
        ) : null}
        {fix ? <p>{signalLabel(signal)}</p> : null}
      </div>
    </div>
  )
}
