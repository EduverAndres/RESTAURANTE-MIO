'use client'

import {
  BikeIcon,
  ClockIcon,
  HomeIcon,
  SearchIcon,
  StoreIcon,
} from 'lucide-react'
import { useCallback, useEffect, useMemo, useRef } from 'react'
import { getCourierPosition } from '@/app/(protected)/orders/[id]/actions'
import { LocationMapLazy } from '@/components/map/location-map-lazy'
import type { MapMarker } from '@/components/map/location-map'
import { useNow } from '@/components/map/use-now'
import {
  useCourierPosition,
  type CourierFix,
} from '@/components/orders/use-courier-position'
import { formatEta } from '@/lib/courier/eta'
import { BOGOTA_CENTER, formatDistance, type LatLng } from '@/lib/geo'
import { initialsOf } from '@/lib/format'
import {
  delayLabel,
  isStalled,
  signalLabel,
  type TimedPoint,
} from '@/lib/tracking/eta'
import { courierTrackingView } from '@/lib/tracking/live-view'
import { routeFromGeometry, toGeometry } from '@/lib/tracking/route-progress'
import { cn } from '@/lib/utils'
import type { OrderStatus } from '@/types/app'

interface DeliveryMapProps {
  orderId: string
  status: OrderStatus
  courierId: string | null
  courierName: string | null
  store: LatLng | null
  customer: LatLng | null
  /** Last known courier fix rendered by the server. */
  initialCourier: CourierFix | null
  /** [lng, lat] pairs of the route computed on the server. */
  path: [number, number][]
  /** Promised arrival, as stored on the order. */
  estimatedAt: string | null
}

/** Fixes kept to tell "parked" from "moving"; a few minutes at the throttle. */
const HISTORY_LIMIT = 60

export function DeliveryMap({
  orderId,
  status,
  courierId,
  courierName,
  store,
  customer,
  initialCourier,
  path,
  estimatedAt,
}: DeliveryMapProps) {
  const enRoute = status === 'picked_up'
  const poll = useCallback(() => getCourierPosition(orderId), [orderId])
  const fix = useCourierPosition({
    courierId,
    initial: initialCourier,
    expectLive: enRoute,
    poll,
  })
  const now = useNow(Boolean(courierId))
  const route = useMemo(() => routeFromGeometry(path), [path])

  const historyRef = useRef<TimedPoint[]>([])
  useEffect(() => {
    if (!fix) return
    const at = new Date(fix.updatedAt)
    const history = historyRef.current
    const last = history[history.length - 1]
    if (last && last.at.getTime() === at.getTime()) return
    history.push({ at, point: { lat: fix.lat, lng: fix.lng } })
    if (history.length > HISTORY_LIMIT) history.shift()
  }, [fix])

  const view = useMemo(
    () =>
      courierTrackingView({
        raw: fix ? { lat: fix.lat, lng: fix.lng } : null,
        // Before pickup the courier is heading to the store; the route drawn
        // is store -> customer, so projecting onto it would be a lie.
        route: enRoute ? route : [],
        destination: customer,
        updatedAt: fix?.updatedAt ?? null,
        estimatedAt,
        now,
      }),
    [customer, enRoute, estimatedAt, fix, now, route],
  )
  const stalled =
    enRoute && fix ? isStalled({ positions: historyRef.current, now }) : false

  const displayPoint = view.point
  const displayKey = displayPoint
    ? `${displayPoint.lat},${displayPoint.lng}`
    : null

  const markers = useMemo(() => {
    const list: MapMarker[] = []
    if (store)
      list.push({ id: 'store', kind: 'store', label: 'Restaurante', ...store })
    if (customer)
      list.push({
        id: 'customer',
        kind: 'customer',
        label: 'Tu casa',
        ...customer,
      })
    if (displayPoint && fix)
      list.push({
        id: 'courier',
        kind: 'courier',
        label: 'Domiciliario',
        ...displayPoint,
        heading: fix.heading,
        live: view.signal.kind === 'live',
        muted: view.signal.kind === 'lost',
        accuracyM: fix.accuracyM,
      })
    return list
    // `displayKey` stands in for the point so a fresh-but-equal object does
    // not rebuild the marker list every second.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [
    store,
    customer,
    displayKey,
    fix?.heading,
    fix?.accuracyM,
    view.signal.kind,
  ])

  const { ahead, done } = useMemo(
    () =>
      enRoute && route.length > 1
        ? { ahead: toGeometry(view.ahead), done: toGeometry(view.done) }
        : { ahead: courierId ? path : [], done: [] },
    // Same reasoning as above: the split only moves with the point.
    // eslint-disable-next-line react-hooks/exhaustive-deps
    [enRoute, route, path, courierId, displayKey],
  )

  const fitPoints = useMemo(
    () => markers.map(({ lat, lng }) => ({ lat, lng })),
    [markers],
  )

  const etaAt = view.eta ?? estimatedAt
  const etaClock = enRoute ? formatEta(etaAt) : null
  const remaining =
    view.remainingKm !== null ? formatDistance(view.remainingKm) : null

  const distanceCopy = (() => {
    if (!fix) return 'Esperando la ubicación del domiciliario…'
    if (enRoute && stalled)
      return 'El domiciliario lleva unos minutos sin moverse. Puede estar en un semáforo o entregando otro pedido.'
    if (enRoute && view.delay?.kind === 'late')
      return `Va con retraso de ${view.delay.minutes} min. Te avisaremos apenas llegue.`
    if (remaining) return `Está a ${remaining} de ti.`
    return 'Ubicación recibida.'
  })()

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
              {/* The dot says "live" only while fixes are actually arriving. */}
              <span
                aria-hidden="true"
                className={cn(
                  'ring-card absolute -right-0.5 -bottom-0.5 size-3.5 rounded-full ring-2',
                  view.signal.kind === 'live' && 'bg-success',
                  view.signal.kind === 'stale' && 'bg-primary',
                  view.signal.kind === 'lost' && 'bg-muted-foreground/50',
                )}
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
              <p className="text-muted-foreground text-sm">{distanceCopy}</p>
              {fix ? (
                <p className="text-muted-foreground mt-0.5 text-xs">
                  {signalLabel(view.signal)}
                </p>
              ) : null}
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

      {fitPoints.length > 0 ? (
        <div className="relative">
          <LocationMapLazy
            center={fitPoints[0] ?? BOGOTA_CENTER}
            markers={markers}
            path={ahead}
            pathDone={done}
            fitTo={fitPoints}
            className="h-[60vh] max-h-[520px] min-h-72 w-full md:h-96"
          />
          {etaClock ? (
            <div
              className="bg-card/95 text-foreground shadow-1 pointer-events-none absolute top-3 left-3 z-[400] flex items-center gap-2 rounded-full px-3 py-1.5 text-sm font-medium backdrop-blur"
              aria-live="off"
            >
              <ClockIcon aria-hidden="true" className="text-primary size-4" />
              <span>Llega ~{etaClock}</span>
              {view.delay ? (
                <span
                  className={cn(
                    'rounded-full px-2 py-0.5 text-xs font-semibold',
                    view.delay.kind === 'late'
                      ? 'bg-destructive/10 text-destructive'
                      : 'bg-success/10 text-success-on-tint',
                  )}
                >
                  {delayLabel(view.delay)}
                </span>
              ) : null}
            </div>
          ) : null}
        </div>
      ) : null}

      {fitPoints.length > 0 ? (
        <ul
          aria-label="Leyenda del mapa"
          className="text-muted-foreground flex flex-wrap gap-2 px-4 py-3 text-xs"
        >
          {store ? (
            <li className="bg-muted/60 inline-flex items-center gap-1.5 rounded-full px-2.5 py-1">
              <StoreIcon aria-hidden="true" className="text-primary size-3.5" />
              Restaurante
            </li>
          ) : null}
          {fix ? (
            <li className="bg-muted/60 inline-flex items-center gap-1.5 rounded-full px-2.5 py-1">
              <BikeIcon
                aria-hidden="true"
                className="size-3.5 text-[#2563EB]"
              />
              Domiciliario
            </li>
          ) : null}
          {customer ? (
            <li className="bg-muted/60 inline-flex items-center gap-1.5 rounded-full px-2.5 py-1">
              <HomeIcon
                aria-hidden="true"
                className="size-3.5 text-[#0F766E]"
              />
              Tu casa
            </li>
          ) : null}
        </ul>
      ) : null}
    </section>
  )
}
