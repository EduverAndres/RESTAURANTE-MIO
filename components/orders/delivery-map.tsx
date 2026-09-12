'use client'

import { BikeIcon, SearchIcon } from 'lucide-react'
import { useEffect, useState } from 'react'
import { LocationMapLazy } from '@/components/map/location-map-lazy'
import type { MapMarker } from '@/components/map/location-map'
import { useRealtimeChannel } from '@/components/providers/realtime-provider'
import {
  BOGOTA_CENTER,
  formatDistance,
  haversineKm,
  type LatLng,
} from '@/lib/geo'
import type { CourierLocation } from '@/types/app'

interface DeliveryMapProps {
  courierId: string | null
  courierName: string | null
  store: LatLng | null
  customer: LatLng | null
  /** Last known courier position rendered by the server. */
  initialCourier: LatLng | null
  /** [lng, lat] pairs of the route computed on the server. */
  path: [number, number][]
}

/** Follows the courier's row in courier_locations; RLS scopes what is visible. */
function useCourierPosition(
  courierId: string | null,
  initial: LatLng | null,
): LatLng | null {
  const [position, setPosition] = useState(initial)

  useEffect(() => setPosition(initial), [initial])

  useRealtimeChannel({
    name: `courier-position-${courierId ?? 'none'}`,
    table: 'courier_locations',
    event: '*',
    filter: `courier_id=eq.${courierId}`,
    enabled: Boolean(courierId),
    // The payload carries the whole position, so the marker is the one place
    // where the event *is* the truth and no server round-trip is needed.
    onEvent: (payload) => {
      const next = payload.new as unknown as Partial<CourierLocation>
      if (typeof next.lat === 'number' && typeof next.lng === 'number') {
        setPosition({ lat: next.lat, lng: next.lng })
      }
    },
  })

  return position
}

export function DeliveryMap({
  courierId,
  courierName,
  store,
  customer,
  initialCourier,
  path,
}: DeliveryMapProps) {
  const courier = useCourierPosition(courierId, initialCourier)

  const markers: MapMarker[] = []
  if (store)
    markers.push({ id: 'store', kind: 'store', label: 'Restaurante', ...store })
  if (customer)
    markers.push({ id: 'customer', kind: 'customer', label: 'Tú', ...customer })
  if (courier)
    markers.push({
      id: 'courier',
      kind: 'courier',
      label: 'Domiciliario',
      ...courier,
    })
  const points = markers.map(({ lat, lng }) => ({ lat, lng }))

  const distance =
    courier && customer ? formatDistance(haversineKm(courier, customer)) : null

  return (
    <section
      aria-label="Seguimiento de la entrega"
      className="rounded-card border-border bg-card shadow-soft space-y-3 border p-4"
    >
      <div role="status" aria-live="polite" className="flex items-start gap-3">
        <span className="bg-primary/12 text-primary flex size-9 shrink-0 items-center justify-center rounded-full">
          {courierId ? (
            <BikeIcon aria-hidden="true" className="size-4" />
          ) : (
            <SearchIcon aria-hidden="true" className="size-4 animate-pulse" />
          )}
        </span>
        <div className="min-w-0">
          {courierId ? (
            <>
              <p className="text-sm font-semibold">
                Tu domiciliario: {courierName ?? 'asignado'}
              </p>
              <p className="text-muted-foreground text-xs">
                {distance
                  ? `Está a ${distance} de ti.`
                  : 'Esperando la ubicación del domiciliario…'}
              </p>
            </>
          ) : (
            <>
              <p className="text-sm font-semibold">Buscando domiciliario…</p>
              <p className="text-muted-foreground text-xs">
                Tu pedido está listo; un domiciliario lo tomará en breve.
              </p>
            </>
          )}
        </div>
      </div>

      {points.length > 0 ? (
        <LocationMapLazy
          center={points[0] ?? BOGOTA_CENTER}
          markers={markers}
          path={courierId ? path : []}
          fitTo={points}
          className="rounded-card h-64 w-full overflow-hidden"
        />
      ) : null}
    </section>
  )
}
