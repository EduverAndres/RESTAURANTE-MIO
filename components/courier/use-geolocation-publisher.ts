'use client'

import { useEffect, useRef, useState } from 'react'
import { toast } from 'sonner'
import { publishLocation } from '@/app/courier/actions'
import {
  compassHeading,
  shouldPublishPosition,
  type TimedPosition,
} from '@/lib/courier/eta'
import {
  classifyPositionError,
  detectGeolocationSupport,
} from '@/lib/geo/geolocation-availability'

export type GeolocationPublisherState =
  | 'idle'
  | 'watching'
  | 'denied'
  | 'unsupported'
  | 'insecure'
  | 'timeout'
  | 'error'

const THROTTLE = { minMeters: 15, minMs: 4000 }
const WATCH_OPTIONS: PositionOptions = {
  enableHighAccuracy: true,
  maximumAge: 5_000,
  timeout: 15_000,
}

/**
 * While `enabled`, follows the device position and publishes it through the
 * server action, throttled so GPS jitter and rapid fixes do not flood the
 * database. Permission and hardware problems surface as a single toast and a
 * state the UI can describe; they never throw.
 */
export function useGeolocationPublisher(
  enabled: boolean,
): GeolocationPublisherState {
  const [state, setState] = useState<GeolocationPublisherState>('idle')
  const lastRef = useRef<TimedPosition | null>(null)
  const warnedRef = useRef(false)

  useEffect(() => {
    if (!enabled) {
      lastRef.current = null
      warnedRef.current = false
      setState('idle')
      return
    }
    const support = detectGeolocationSupport(window)
    if (support === 'unsupported') {
      setState('unsupported')
      toast.error('Tu dispositivo no permite compartir la ubicación.')
      return
    }
    if (support === 'insecure') {
      setState('insecure')
      toast.error(
        'El navegador bloquea la ubicación en conexiones sin https. Abre la app desde una dirección segura.',
      )
      return
    }

    let cancelled = false
    setState('watching')

    const watchId = navigator.geolocation.watchPosition(
      (position) => {
        if (cancelled) return
        const next: TimedPosition = {
          lat: position.coords.latitude,
          lng: position.coords.longitude,
          at: position.timestamp || Date.now(),
        }
        if (!shouldPublishPosition(lastRef.current, next, THROTTLE)) return

        const deviceHeading = position.coords.heading
        const heading =
          typeof deviceHeading === 'number' && Number.isFinite(deviceHeading)
            ? deviceHeading
            : lastRef.current
              ? compassHeading(lastRef.current, next)
              : null
        lastRef.current = next

        // Accuracy travels with the fix so the customer's map can draw how
        // much to trust it; the schema drops anything non-finite.
        void publishLocation({
          lat: next.lat,
          lng: next.lng,
          heading,
          accuracyM: position.coords.accuracy,
        })
          .then((result) => {
            if (cancelled || result.ok || warnedRef.current) return
            warnedRef.current = true
            toast.error(result.error)
          })
          .catch(() => {
            // A dropped connection rejects the action outright; the next
            // fix retries, so it is worth one warning, not one per ping.
            if (cancelled || warnedRef.current) return
            warnedRef.current = true
            toast.error('No pudimos compartir tu ubicación.')
          })
      },
      (error) => {
        if (cancelled) return
        const reason = classifyPositionError(error.code)
        if (reason === 'denied') {
          setState('denied')
          // watchPosition keeps firing while the permission stays denied, so
          // the toast is throttled exactly like the timeout/error branch.
          if (!warnedRef.current) {
            warnedRef.current = true
            toast.error(
              'Permite el acceso a tu ubicación para ponerte en línea.',
            )
          }
          return
        }
        setState(reason === 'timeout' ? 'timeout' : 'error')
        if (!warnedRef.current) {
          warnedRef.current = true
          toast.error('No pudimos obtener tu ubicación. Seguiremos intentando.')
        }
      },
      WATCH_OPTIONS,
    )

    return () => {
      cancelled = true
      navigator.geolocation.clearWatch(watchId)
    }
  }, [enabled])

  return state
}
