'use client'

import { RouteIcon } from 'lucide-react'
import { LocationMapLazy } from '@/components/map/location-map-lazy'
import type { MapMarker } from '@/components/map/location-map'
import { BOGOTA_CENTER, formatDistance, type LatLng } from '@/lib/geo'

interface CourierOrderMapProps {
  store: LatLng | null
  customer: LatLng | null
  courier: LatLng | null
  /** [lng, lat] pairs of the server-computed route. */
  path: [number, number][]
  routeKm: number | null
  routeMin: number | null
}

/** Map of store, customer and courier with the route drawn between them. */
export function CourierOrderMap({
  store,
  customer,
  courier,
  path,
  routeKm,
  routeMin,
}: CourierOrderMapProps) {
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
  if (courier)
    markers.push({ id: 'courier', kind: 'courier', label: 'Tú', ...courier })

  const points = markers.map(({ lat, lng }) => ({ lat, lng }))
  if (points.length === 0) {
    return (
      <p className="rounded-card bg-muted/60 text-muted-foreground p-4 text-sm">
        Sin coordenadas para mostrar el mapa de este pedido.
      </p>
    )
  }

  return (
    <div className="space-y-2">
      <LocationMapLazy
        center={points[0] ?? BOGOTA_CENTER}
        markers={markers}
        path={path}
        fitTo={points}
        className="rounded-card h-72 w-full overflow-hidden sm:h-80"
      />
      {routeKm !== null && routeMin !== null ? (
        <p className="text-muted-foreground flex items-center gap-1.5 text-xs">
          <RouteIcon aria-hidden="true" className="size-3.5" />
          {formatDistance(routeKm)} · unos {Math.max(1, Math.round(routeMin))}{' '}
          min en moto
        </p>
      ) : null}
    </div>
  )
}
