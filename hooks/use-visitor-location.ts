'use client'

import { useRouter } from 'next/navigation'
import { useCallback, useEffect, useState } from 'react'
import type { LatLng } from '@/lib/geo'
import {
  classifyPositionError,
  detectGeolocationSupport,
  GeolocationFailureError,
  type GeolocationSupport,
} from '@/lib/geo/geolocation-availability'
import {
  LOCATION_COOKIE,
  LOCATION_COOKIE_MAX_AGE,
  parseLocation,
  serializeLocation,
  type VisitorLocation,
} from '@/lib/location'

/** `unknown` until the effect runs on the client (SSR renders no verdict). */
export type GpsSupport = GeolocationSupport | 'unknown'

function readCookie(): VisitorLocation | null {
  if (typeof document === 'undefined') return null
  const match = document.cookie
    .split('; ')
    .find((entry) => entry.startsWith(`${LOCATION_COOKIE}=`))
  return parseLocation(match?.slice(LOCATION_COOKIE.length + 1))
}

function detectSupport(): GeolocationSupport {
  return detectGeolocationSupport({
    isSecureContext: window.isSecureContext,
    navigator: window.navigator,
  })
}

export function useVisitorLocation(initial: VisitorLocation | null = null) {
  const router = useRouter()
  const [location, setLocationState] = useState<VisitorLocation | null>(initial)
  const [gpsSupport, setGpsSupport] = useState<GpsSupport>('unknown')

  useEffect(() => {
    const fromCookie = readCookie()
    if (fromCookie) setLocationState(fromCookie)
    setGpsSupport(detectSupport())
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
        const support = detectSupport()
        if (support !== 'ok') {
          reject(new GeolocationFailureError(support))
          return
        }
        navigator.geolocation.getCurrentPosition(
          (position) =>
            resolve({
              lat: position.coords.latitude,
              lng: position.coords.longitude,
            }),
          (error) =>
            reject(
              new GeolocationFailureError(classifyPositionError(error.code)),
            ),
          { enableHighAccuracy: true, timeout: 10_000, maximumAge: 60_000 },
        )
      }),
    [],
  )

  return { location, setLocation, locate, gpsSupport }
}
