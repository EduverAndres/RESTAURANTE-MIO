'use client'

import L from 'leaflet'
import 'leaflet/dist/leaflet.css'
import { useEffect, useRef } from 'react'
import type { LatLng } from '@/lib/geo'

export interface MapMarker extends LatLng {
  id: string
  kind: 'store' | 'customer' | 'courier' | 'pin'
  label?: string
}

interface LocationMapProps {
  center: LatLng
  zoom?: number
  markers?: MapMarker[]
  /** [lng, lat] pairs drawn as a route line. */
  path?: [number, number][]
  /** Draggable pin; when set, clicking or dragging reports a new point. */
  pin?: LatLng | null
  onPinChange?: (point: LatLng) => void
  /**
   * When given (non-empty), the viewport is fitted to these points instead
   * of following `center`/`zoom`. Re-fits whenever the coordinates change.
   */
  fitTo?: LatLng[]
  className?: string
}

const FIT_PADDING: [number, number] = [40, 40]
const FIT_MAX_ZOOM = 16

const MARKER_COLORS: Record<MapMarker['kind'], string> = {
  store: 'var(--primary)',
  customer: '#0F766E',
  courier: '#2563EB',
  pin: 'var(--primary)',
}

function iconFor(kind: MapMarker['kind']): L.DivIcon {
  const color = MARKER_COLORS[kind]
  const glyph =
    kind === 'courier'
      ? '<circle cx="12" cy="12" r="5" fill="white"/>'
      : '<circle cx="12" cy="10" r="3.5" fill="white"/>'
  const shape =
    kind === 'courier'
      ? `<circle cx="12" cy="12" r="10" fill="${color}" stroke="white" stroke-width="2"/>`
      : `<path d="M12 23s8-7.6 8-13a8 8 0 1 0-16 0c0 5.4 8 13 8 13Z" fill="${color}" stroke="white" stroke-width="1.5"/>`
  return L.divIcon({
    className: 'tienda-marker',
    html: `<svg viewBox="0 0 24 24" width="34" height="34" aria-hidden="true">${shape}${glyph}</svg>`,
    iconSize: [34, 34],
    iconAnchor: kind === 'courier' ? [17, 17] : [17, 33],
  })
}

/**
 * Thin Leaflet wrapper. Import it through location-map-lazy so it never runs
 * during server rendering (Leaflet touches window at import time).
 */
export function LocationMap({
  center,
  zoom = 14,
  markers = [],
  path = [],
  pin = null,
  onPinChange,
  fitTo,
  className,
}: LocationMapProps) {
  const containerRef = useRef<HTMLDivElement>(null)
  const mapRef = useRef<L.Map | null>(null)
  const layerRef = useRef<L.LayerGroup | null>(null)
  const pinRef = useRef<L.Marker | null>(null)
  const onPinChangeRef = useRef(onPinChange)
  onPinChangeRef.current = onPinChange

  useEffect(() => {
    if (!containerRef.current || mapRef.current) return
    const map = L.map(containerRef.current, {
      center: [center.lat, center.lng],
      zoom,
      zoomControl: true,
      attributionControl: true,
    })
    L.tileLayer('https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png', {
      maxZoom: 19,
      attribution:
        '&copy; <a href="https://www.openstreetmap.org/copyright">OpenStreetMap</a>',
    }).addTo(map)
    map.on('click', (event: L.LeafletMouseEvent) => {
      onPinChangeRef.current?.({ lat: event.latlng.lat, lng: event.latlng.lng })
    })
    layerRef.current = L.layerGroup().addTo(map)
    mapRef.current = map
    return () => {
      map.remove()
      mapRef.current = null
      layerRef.current = null
      pinRef.current = null
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
    const bounds = L.latLngBounds(
      fitKey.split(';').map((pair) => {
        const [lat, lng] = pair.split(',').map(Number)
        return [lat, lng] as [number, number]
      }),
    )
    if (!bounds.isValid()) return
    map.fitBounds(bounds, {
      padding: FIT_PADDING,
      maxZoom: FIT_MAX_ZOOM,
      animate: true,
    })
  }, [fitKey])

  useEffect(() => {
    const layer = layerRef.current
    if (!layer) return
    layer.clearLayers()
    markers.forEach((marker) => {
      const leafletMarker = L.marker([marker.lat, marker.lng], {
        icon: iconFor(marker.kind),
      })
      if (marker.label)
        leafletMarker.bindTooltip(marker.label, {
          direction: 'top',
          offset: [0, -28],
        })
      leafletMarker.addTo(layer)
    })
    if (path.length > 1) {
      L.polyline(
        path.map(([lng, lat]) => [lat, lng] as [number, number]),
        {
          color: '#2563EB',
          weight: 4,
          opacity: 0.8,
          dashArray: '2 8',
          lineCap: 'round',
        },
      ).addTo(layer)
    }
  }, [markers, path])

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
        icon: iconFor('pin'),
        draggable: true,
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
