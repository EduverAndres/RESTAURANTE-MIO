'use client'

import { BikeIcon, SearchIcon } from 'lucide-react'
import { useEffect, useState } from 'react'
import { LocationMapLazy } from '@/components/map/location-map-lazy'
import type { MapMarker } from '@/components/map/location-map'
import { useRealtimeChannel } from '@/components/providers/realtime-provider'
import {
  DEFAULT_MAP_CENTER,
  formatDistance,
  haversineKm,
  type LatLng,
} from '@/lib/geo'
import { initialsOf } from '@/lib/format'
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
      className="rounded-card border-border bg-card shadow-1 overflow-hidden border"
    >
      {/*
        The courier card. The person carrying your dinner deserves a name and
        a face, not a line of metadata: a customer who can see who is coming
        stops refreshing the page.

        The live region is the assignment sentence only, not this whole block.
        The distance line below it is rewritten on every GPS ping, which had
        the courier's position read out loud every few seconds; what a
        customer actually needs to hear is "a courier took your order".
      */}
      <div className="p-card flex items-center gap-3">
        <span className="bg-primary/12 text-primary-on-tint relative grid size-12 shrink-0 place-items-center rounded-full">
          {courierId ? (
            <>
              <span className="font-display text-base font-semibold">
                {courierName ? initialsOf(courierName) : null}
              </span>
              {!courierName ? (
                <BikeIcon aria-hidden="true" className="size-5" />
              ) : null}
              {/* A quiet pulse: the only thing on the page that says "live". */}
              <span
                aria-hidden="true"
                className="bg-success ring-card absolute -right-0.5 -bottom-0.5 size-3.5 rounded-full ring-2"
              />
            </>
          ) : (
            <SearchIcon aria-hidden="true" className="size-5 animate-pulse" />
          )}
        </span>
        <div className="min-w-0 flex-1">
          {courierId ? (
            <>
              <p role="status" className="text-base font-semibold">
                {courierName ?? 'Domiciliario asignado'}
              </p>
              <p className="text-muted-foreground text-sm">
                {distance
                  ? `Está a ${distance} de ti.`
                  : 'Esperando la ubicación del domiciliario…'}
              </p>
            </>
          ) : (
            <>
              <p role="status" className="text-base font-semibold">
                Buscando domiciliario…
              </p>
              <p className="text-muted-foreground text-sm">
                Tu pedido está listo; un domiciliario lo tomará en breve.
              </p>
            </>
          )}
        </div>
        <BikeIcon
          aria-hidden="true"
          className="text-muted-foreground/50 hidden size-8 shrink-0 sm:block"
        />
      </div>

      {points.length > 0 ? (
        <LocationMapLazy
          center={points[0] ?? DEFAULT_MAP_CENTER}
          markers={markers}
          path={courierId ? path : []}
          fitTo={points}
          className="h-72 w-full"
        />
      ) : null}
    </section>
  )
}
