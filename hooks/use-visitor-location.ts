'use client'

import { useRouter } from 'next/navigation'
import { useCallback, useEffect, useState } from 'react'
import type { LatLng } from '@/lib/geo'
import {
  LOCATION_COOKIE,
  LOCATION_COOKIE_MAX_AGE,
  parseLocation,
  serializeLocation,
  type VisitorLocation,
} from '@/lib/location'

function readCookie(): VisitorLocation | null {
  if (typeof document === 'undefined') return null
  const match = document.cookie
    .split('; ')
    .find((entry) => entry.startsWith(`${LOCATION_COOKIE}=`))
  return parseLocation(match?.slice(LOCATION_COOKIE.length + 1))
}

export function useVisitorLocation(initial: VisitorLocation | null = null) {
  const router = useRouter()
  const [location, setLocationState] = useState<VisitorLocation | null>(initial)

  useEffect(() => {
    const fromCookie = readCookie()
    if (fromCookie) setLocationState(fromCookie)
  }, [])

  const setLocation = useCallback(
    (next: VisitorLocation) => {
      document.cookie = `${LOCATION_COOKIE}=${serializeLocation(next)}; path=/; max-age=${LOCATION_COOKIE_MAX_AGE}; samesite=lax`
      setLocationState(next)
      // Server components re-rank stores by the new cookie.
      router.refresh()
    },
    [router],
  )

  const locate = useCallback(
    () =>
      new Promise<LatLng>((resolve, reject) => {
        if (!('geolocation' in navigator)) {
          reject(new Error('Tu navegador no permite obtener la ubicación.'))
          return
        }
        navigator.geolocation.getCurrentPosition(
          (position) =>
            resolve({
              lat: position.coords.latitude,
              lng: position.coords.longitude,
            }),
          () =>
            reject(
              new Error(
                'No pudimos obtener tu ubicación. Revisa los permisos.',
              ),
            ),
          { enableHighAccuracy: true, timeout: 10_000, maximumAge: 60_000 },
        )
      }),
    [],
  )

  return { location, setLocation, locate }
}
