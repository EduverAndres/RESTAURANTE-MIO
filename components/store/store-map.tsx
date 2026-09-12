'use client'

import { LocationMapLazy } from '@/components/map/location-map-lazy'
import type { LatLng } from '@/lib/geo'

interface StoreMapProps {
  center: LatLng
  label: string
}

/**
 * The shared Leaflet map, wearing the tenant's colour.
 *
 * The marker is drawn with `var(--primary)`, so re-pointing that single
 * variable on the wrapper themes the pin without the map component needing to
 * know a storefront exists. Leaflet itself is loaded lazily and never on the
 * server.
 */
export function StoreMap({ center, label }: StoreMapProps) {
  return (
    <div
      style={{ ['--primary' as string]: 'var(--store-primary)' }}
      className="h-72 w-full overflow-hidden rounded-[var(--store-radius)] [border:var(--store-card-border)]"
    >
      <LocationMapLazy
        center={center}
        zoom={15}
        markers={[{ id: 'store', kind: 'store', label, ...center }]}
        className="h-72 w-full"
      />
    </div>
  )
}
