'use client'

import L from 'leaflet'
import 'leaflet/dist/leaflet.css'
import { useEffect, useRef } from 'react'
import type { LatLng } from '@/lib/geo'
import { easeOut, interpolate } from '@/lib/tracking/interpolate'

export interface MapMarker extends LatLng {
  id: string
  kind: 'store' | 'customer' | 'courier' | 'pin'
  label?: string
  /** Degrees clockwise from north; rotates the courier glyph. */
  heading?: number | null
  /** Pulses the courier ring: a fix arrived recently. */
  live?: boolean
  /** Greys the marker: the signal is stale or lost. */
  muted?: boolean
  /** GPS accuracy radius drawn as a circle around the marker, in metres. */
  accuracyM?: number | null
}

interface LocationMapProps {
  center: LatLng
  zoom?: number
  markers?: MapMarker[]
  /** [lng, lat] pairs drawn as the route still ahead. */
  path?: [number, number][]
  /** [lng, lat] pairs drawn as the route already travelled. */
  pathDone?: [number, number][]
  /** Draggable pin; when set, clicking or dragging reports a new point. */
  pin?: LatLng | null
  onPinChange?: (point: LatLng) => void
  /**
   * When given (non-empty), the viewport is fitted to these points instead
   * of following `center`/`zoom`: once on mount, again when a point appears
   * or disappears, and otherwise only when a point leaves the viewport. A
   * moving courier therefore never yanks the map on every fix.
   */
  fitTo?: LatLng[]
  className?: string
}

const FIT_PADDING: [number, number] = [40, 40]
const FIT_MAX_ZOOM = 16
/** How long the courier marker glides from one fix to the next. */
const GLIDE_MS = 800
const ROUTE_COLOR = '#2563EB'
const DONE_COLOR = '#9CA3AF'

const GLYPHS: Record<MapMarker['kind'], string> = {
  // Storefront.
  store:
    '<path d="M4 10 5.2 5h13.6L20 10M4 10v9h16v-9M4 10h16M9 19v-5h6v5" fill="none" stroke="currentColor" stroke-width="1.8" stroke-linejoin="round" stroke-linecap="round"/>',
  // Home.
  customer:
    '<path d="M4 11.5 12 5l8 6.5M6.5 10v9h11v-9M10 19v-5h4v5" fill="none" stroke="currentColor" stroke-width="1.8" stroke-linejoin="round" stroke-linecap="round"/>',
  // Bike, drawn facing up so `heading` rotates it the right way.
  courier:
    '<path d="M12 3v7M12 10l-3.5 6M12 10l3.5 6M8 17h8M12 3l-2 2M12 3l2 2" fill="none" stroke="currentColor" stroke-width="1.8" stroke-linecap="round" stroke-linejoin="round"/>',
  // Plain dot for the draggable pin.
  pin: '<circle cx="12" cy="12" r="3.5" fill="currentColor"/>',
}

function iconFor(marker: Pick<MapMarker, 'kind' | 'label'>): L.DivIcon {
  const { kind, label } = marker
  const glyph = GLYPHS[kind]
  const caption = label
    ? `<span class="tienda-marker__label">${escapeHtml(label)}</span>`
    : ''
  return L.divIcon({
    className: `tienda-marker tienda-marker--${kind}`,
    html: `<span class="tienda-marker__ring" aria-hidden="true"></span><span class="tienda-marker__badge"><svg class="tienda-marker__glyph" viewBox="0 0 24 24" width="22" height="22" aria-hidden="true">${glyph}</svg></span>${caption}`,
    iconSize: [44, 44],
    iconAnchor: [22, 22],
    tooltipAnchor: [0, -24],
  })
}

function escapeHtml(text: string): string {
  return text
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
}

function toLatLngs(path: [number, number][]): [number, number][] {
  return path.map(([lng, lat]) => [lat, lng] as [number, number])
}

function prefersReducedMotion(): boolean {
  return (
    typeof window !== 'undefined' &&
    typeof window.matchMedia === 'function' &&
    window.matchMedia('(prefers-reduced-motion: reduce)').matches
  )
}

interface ManagedMarker {
  marker: L.Marker
  circle: L.Circle | null
  /** Where the marker is drawn right now (mid-glide it differs from the target). */
  shown: LatLng
  /** The fix the marker is heading to; only a different one restarts a glide. */
  target: LatLng
  animation: number | null
}

/** Applies heading/live/muted to the marker's DOM without rebuilding the icon. */
function decorate(managed: ManagedMarker, marker: MapMarker): void {
  const element = managed.marker.getElement()
  if (!element) return
  element.classList.toggle('is-live', Boolean(marker.live))
  element.classList.toggle('is-muted', Boolean(marker.muted))
  const glyph = element.querySelector<SVGElement>('.tienda-marker__glyph')
  if (glyph && marker.kind === 'courier') {
    const heading =
      typeof marker.heading === 'number' && Number.isFinite(marker.heading)
        ? marker.heading
        : null
    glyph.style.transform = heading === null ? '' : `rotate(${heading}deg)`
  }
}

/**
 * Thin Leaflet wrapper. Import it through location-map-lazy so it never runs
 * during server rendering (Leaflet touches window at import time).
 *
 * Markers are created once and moved with `setLatLng`; the courier glides
 * between fixes with requestAnimationFrame. Rebuilding every layer on every
 * GPS ping — the previous approach — is what made the map jitter.
 */
export function LocationMap({
  center,
  zoom = 14,
  markers = [],
  path = [],
  pathDone = [],
  pin = null,
  onPinChange,
  fitTo,
  className,
}: LocationMapProps) {
  const containerRef = useRef<HTMLDivElement>(null)
  const mapRef = useRef<L.Map | null>(null)
  const markerLayerRef = useRef<L.LayerGroup | null>(null)
  const routeLayerRef = useRef<L.LayerGroup | null>(null)
  const managedRef = useRef<Map<string, ManagedMarker>>(new Map())
  const pinRef = useRef<L.Marker | null>(null)
  const onPinChangeRef = useRef(onPinChange)
  onPinChangeRef.current = onPinChange
  const fittedCountRef = useRef<number | null>(null)

  useEffect(() => {
    if (!containerRef.current || mapRef.current) return
    const map = L.map(containerRef.current, {
      center: [center.lat, center.lng],
      zoom,
      zoomControl: true,
      attributionControl: true,
    })
    // CARTO's public basemaps started requiring an API key (tiles render an
    // "API KEY REQUIRED" watermark), so the standard OSM raster is used.
    L.tileLayer('https://tile.openstreetmap.org/{z}/{x}/{y}.png', {
      maxZoom: 19,
      attribution:
        '&copy; <a href="https://www.openstreetmap.org/copyright">OpenStreetMap</a> contributors',
    }).addTo(map)
    map.on('click', (event: L.LeafletMouseEvent) => {
      onPinChangeRef.current?.({ lat: event.latlng.lat, lng: event.latlng.lng })
    })
    routeLayerRef.current = L.layerGroup().addTo(map)
    markerLayerRef.current = L.layerGroup().addTo(map)
    mapRef.current = map
    const managed = managedRef.current
    return () => {
      for (const entry of managed.values()) {
        if (entry.animation !== null) cancelAnimationFrame(entry.animation)
      }
      managed.clear()
      map.remove()
      mapRef.current = null
      markerLayerRef.current = null
      routeLayerRef.current = null
      pinRef.current = null
      fittedCountRef.current = null
    }
    // The map is created once; later prop changes are applied by the effects below.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [])

  // A string key keeps the effect stable when callers pass a fresh array
  // with the same coordinates on every render.
  const fitKey =
    fitTo && fitTo.length > 0
      ? fitTo.map((point) => `${point.lat},${point.lng}`).join(';')
      : null

  useEffect(() => {
    if (fitKey) return
    mapRef.current?.setView([center.lat, center.lng], zoom, { animate: true })
  }, [center.lat, center.lng, zoom, fitKey])

  useEffect(() => {
    const map = mapRef.current
    if (!map || !fitKey) return
    const points = fitKey.split(';').map((pair) => {
      const [lat, lng] = pair.split(',').map(Number)
      return L.latLng(lat!, lng!)
    })
    const bounds = L.latLngBounds(points)
    if (!bounds.isValid()) return

    const countChanged = fittedCountRef.current !== points.length
    const escaped =
      !countChanged && points.some((point) => !map.getBounds().contains(point))
    if (!countChanged && !escaped) return

    fittedCountRef.current = points.length
    map.fitBounds(bounds, {
      padding: FIT_PADDING,
      maxZoom: FIT_MAX_ZOOM,
      animate: !prefersReducedMotion(),
    })
  }, [fitKey])

  useEffect(() => {
    const layer = markerLayerRef.current
    const map = mapRef.current
    if (!layer || !map) return
    const managed = managedRef.current
    const seen = new Set<string>()

    for (const marker of markers) {
      seen.add(marker.id)
      const target = { lat: marker.lat, lng: marker.lng }
      let entry = managed.get(marker.id)

      if (!entry) {
        // Leaflet makes every marker a focusable `role="button"`, so it needs
        // a name: `title` and `alt` both land on the icon element and the
        // tooltip alone is not one, because it only exists while hovered.
        const leafletMarker = L.marker([marker.lat, marker.lng], {
          icon: iconFor(marker),
          title: marker.label,
          alt: marker.label,
          keyboard: true,
        })
        if (marker.label)
          leafletMarker.bindTooltip(marker.label, { direction: 'top' })
        leafletMarker.addTo(layer)
        entry = {
          marker: leafletMarker,
          circle: null,
          shown: target,
          target,
          animation: null,
        }
        managed.set(marker.id, entry)
      } else if (
        entry.target.lat !== target.lat ||
        entry.target.lng !== target.lng
      ) {
        if (entry.animation !== null) cancelAnimationFrame(entry.animation)
        entry.animation = null
        entry.target = target
        if (marker.kind === 'courier' && !prefersReducedMotion()) {
          glide(entry, target)
        } else {
          entry.shown = target
          entry.marker.setLatLng([target.lat, target.lng])
        }
      }

      const radius =
        typeof marker.accuracyM === 'number' && marker.accuracyM > 0
          ? marker.accuracyM
          : null
      if (radius === null) {
        entry.circle?.remove()
        entry.circle = null
      } else if (!entry.circle) {
        entry.circle = L.circle([target.lat, target.lng], {
          radius,
          color: ROUTE_COLOR,
          weight: 1,
          opacity: 0.35,
          fillColor: ROUTE_COLOR,
          fillOpacity: 0.08,
          interactive: false,
        }).addTo(layer)
      } else {
        entry.circle.setLatLng([target.lat, target.lng])
        entry.circle.setRadius(radius)
      }

      decorate(entry, marker)
    }

    for (const [id, entry] of managed) {
      if (seen.has(id)) continue
      if (entry.animation !== null) cancelAnimationFrame(entry.animation)
      entry.circle?.remove()
      entry.marker.remove()
      managed.delete(id)
    }
  }, [markers])

  useEffect(() => {
    const layer = routeLayerRef.current
    if (!layer) return
    layer.clearLayers()
    if (pathDone.length > 1) {
      L.polyline(toLatLngs(pathDone), {
        color: DONE_COLOR,
        weight: 4,
        opacity: 0.7,
        lineCap: 'round',
        lineJoin: 'round',
        interactive: false,
      }).addTo(layer)
    }
    if (path.length > 1) {
      L.polyline(toLatLngs(path), {
        color: ROUTE_COLOR,
        weight: 4,
        opacity: 0.85,
        lineCap: 'round',
        lineJoin: 'round',
        interactive: false,
      }).addTo(layer)
    }
  }, [path, pathDone])

  useEffect(() => {
    const map = mapRef.current
    if (!map) return
    if (!pin) {
      pinRef.current?.remove()
      pinRef.current = null
      return
    }
    if (!pinRef.current) {
      const marker = L.marker([pin.lat, pin.lng], {
        icon: iconFor({ kind: 'pin' }),
        draggable: true,
        title: 'Ubicación elegida; arrástrala para ajustarla',
        alt: 'Ubicación elegida; arrástrala para ajustarla',
      })
      marker.on('dragend', () => {
        const position = marker.getLatLng()
        onPinChangeRef.current?.({ lat: position.lat, lng: position.lng })
      })
      marker.addTo(map)
      pinRef.current = marker
    } else {
      pinRef.current.setLatLng([pin.lat, pin.lng])
    }
  }, [pin])

  return (
    <div
      ref={containerRef}
      role="application"
      aria-label="Mapa"
      className={className ?? 'h-64 w-full'}
    />
  )
}

/**
 * Moves a marker from where it is drawn to `target` over GLIDE_MS. `shown`
 * is updated on every frame so a fix that lands mid-glide restarts from the
 * drawn position rather than jumping back to the previous target.
 */
function glide(entry: ManagedMarker, target: LatLng): void {
  const from = entry.shown
  const started = performance.now()
  const step = (now: number) => {
    const t = easeOut((now - started) / GLIDE_MS)
    const at = t < 1 ? interpolate(from, target, t) : target
    entry.shown = at
    entry.marker.setLatLng([at.lat, at.lng])
    entry.animation = t < 1 ? requestAnimationFrame(step) : null
  }
  entry.animation = requestAnimationFrame(step)
}
