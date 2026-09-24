'use client'

import { useCallback, useEffect, useRef, useState } from 'react'
import {
  useRealtimeChannel,
  useRealtimeStatus,
} from '@/components/providers/realtime-provider'
import type { LatLng } from '@/lib/geo'
import { POLL_INTERVAL_MS, shouldPollFallback } from '@/lib/tracking/live-view'
import type { CourierLocation } from '@/types/app'

/** A courier fix as the browser holds it; mirrors `courier_locations`. */
export interface CourierFix extends LatLng {
  heading: number | null
  accuracyM: number | null
  updatedAt: string
}

interface UseCourierPositionOptions {
  courierId: string | null
  /** Last fix rendered by the server, or null before the first one. */
  initial: CourierFix | null
  /** True while fixes are expected to keep coming (the courier is en route). */
  expectLive: boolean
  /**
   * Server read used when realtime is quiet or down. Optional: without it
   * the hook only listens.
   */
  poll?: () => Promise<CourierFix | null>
}

function fixFromRow(row: Partial<CourierLocation>): CourierFix | null {
  if (typeof row.lat !== 'number' || typeof row.lng !== 'number') return null
  return {
    lat: row.lat,
    lng: row.lng,
    heading: typeof row.heading === 'number' ? row.heading : null,
    accuracyM:
      typeof row.accuracy_m === 'number'
        ? row.accuracy_m
        : typeof row.accuracy_m === 'string'
          ? Number(row.accuracy_m)
          : null,
    updatedAt:
      typeof row.updated_at === 'string'
        ? row.updated_at
        : new Date().toISOString(),
  }
}

/**
 * Follows a courier's row in `courier_locations`; RLS scopes what is visible.
 *
 * Deliberate exception to "events are not rendered truth": the payload IS
 * the position — telemetry, not business state — so it goes straight into
 * state and no server round-trip is needed. When the shared channel drops,
 * or a courier who should be moving has been silent for the grace period,
 * the hook polls `poll` every `POLL_INTERVAL_MS` until events resume.
 */
export function useCourierPosition({
  courierId,
  initial,
  expectLive,
  poll,
}: UseCourierPositionOptions): CourierFix | null {
  const [fix, setFix] = useState(initial)
  const realtimeStatus = useRealtimeStatus()
  const lastEventAtRef = useRef<number | null>(null)
  const mountedAtRef = useRef(Date.now())
  const pollRef = useRef(poll)
  pollRef.current = poll

  useEffect(() => {
    setFix((current) => {
      // A server render never rewinds a fresher fix the channel delivered.
      if (!initial) return current
      if (current && current.updatedAt > initial.updatedAt) return current
      return initial
    })
  }, [initial])

  const accept = useCallback((next: CourierFix | null) => {
    if (!next) return
    setFix((current) =>
      current && current.updatedAt > next.updatedAt ? current : next,
    )
  }, [])

  useRealtimeChannel({
    name: `courier-position-${courierId ?? 'none'}`,
    table: 'courier_locations',
    event: '*',
    filter: `courier_id=eq.${courierId}`,
    enabled: Boolean(courierId),
    onEvent: (payload) => {
      lastEventAtRef.current = Date.now()
      accept(fixFromRow(payload.new as unknown as Partial<CourierLocation>))
    },
  })

  useEffect(() => {
    if (!courierId || !poll) return
    let cancelled = false
    let inFlight = false
    const tick = async () => {
      if (inFlight) return
      const now = Date.now()
      if (
        !shouldPollFallback({
          realtimeStatus,
          expectLive,
          lastEventAt: lastEventAtRef.current,
          mountedAt: mountedAtRef.current,
          now,
        })
      )
        return
      inFlight = true
      try {
        const next = await pollRef.current?.()
        if (!cancelled) accept(next ?? null)
      } catch {
        // The next tick tries again; a failed poll is not worth a toast.
      } finally {
        inFlight = false
      }
    }
    const interval = window.setInterval(() => void tick(), POLL_INTERVAL_MS)
    return () => {
      cancelled = true
      window.clearInterval(interval)
    }
  }, [accept, courierId, expectLive, poll, realtimeStatus])

  return fix
}
