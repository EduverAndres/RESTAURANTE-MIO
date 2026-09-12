'use client'

import dynamic from 'next/dynamic'
import { Skeleton } from '@/components/ui/skeleton'

// Leaflet reads `window` on import, so the map only loads in the browser.
export const LocationMapLazy = dynamic(
  () =>
    import('@/components/map/location-map').then(
      (module) => module.LocationMap,
    ),
  {
    ssr: false,
    loading: () => <Skeleton className="rounded-card h-64 w-full" />,
  },
)
