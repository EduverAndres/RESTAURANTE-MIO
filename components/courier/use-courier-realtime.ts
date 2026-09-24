'use client'

import { useCallback, useEffect, useMemo, useRef, useState } from 'react'
import { toast } from 'sonner'
import {
  useRealtimeChannel,
  useRealtimeRefresh,
} from '@/components/providers/realtime-provider'
import { createPoolTracker } from '@/lib/courier/pool'
import type { CourierOrderSummary } from '@/lib/courier/orders'
import { createDebouncer } from '@/lib/realtime/debounce'
import { playSoundEvent } from '@/lib/sound/player'
import { createClient } from '@/lib/supabase/client'

/** A reconciliation per burst is enough; the round-trip is a single select. */
const RECONCILE_DEBOUNCE_MS = 250

/**
 * Keeps the courier's available-pool list honest.
 *
 * Two problems the raw subscription cannot solve on its own:
 *
 * 1. `payload.old` is only the primary key (no table uses `replica identity
 *    full`), so "did this order just enter the pool?" cannot be answered from
 *    the event. A client-side tracker remembers the previous state instead.
 *
 * 2. When another courier wins the race, `courier_id` stops matching this
 *    courier's RLS predicate — so *no* event arrives and the card would sit
 *    there forever. Every event, and every backfill, therefore re-reads the
 *    pool ids and drops whatever is gone.
 *
 * The channel itself carries no filter: RLS already limits the stream to the
 * pool and to this courier's own orders.
 */
export function useCourierPool(
  initial: CourierOrderSummary[],
): CourierOrderSummary[] {
  const refresh = useRealtimeRefresh()
  const [available, setAvailable] = useState(initial)
  // Seeded from the server list by the effect below, which runs on mount and
  // on every refresh — always before an event can be delivered.
  const tracker = useMemo(() => createPoolTracker(), [])
  const reconcileDebouncer = useMemo(
    () => createDebouncer(RECONCILE_DEBOUNCE_MS),
    [],
  )
  const supabase = useMemo(() => createClient(), [])
  const mounted = useRef(true)

  useEffect(() => {
    setAvailable(initial)
    tracker.reset(initial.map((order) => order.id))
  }, [initial, tracker])

  useEffect(() => {
    mounted.current = true
    return () => {
      mounted.current = false
      reconcileDebouncer.cancel()
    }
  }, [reconcileDebouncer])

  const reconcile = useCallback(() => {
    reconcileDebouncer.schedule(() => {
      void supabase
        .from('orders')
        .select('id')
        .is('courier_id', null)
        .eq('status', 'ready')
        .eq('type', 'delivery')
        .then(({ data, error }) => {
          if (error || !data || !mounted.current) return
          const ids = new Set(data.map((row) => row.id))
          tracker.reset(ids)
          // Only removals are applied here: an order that appeared needs the
          // store, address and distance the server query assembles.
          setAvailable((current) => {
            const next = current.filter((order) => ids.has(order.id))
            return next.length === current.length ? current : next
          })
        })
    })
  }, [reconcileDebouncer, supabase, tracker])

  useRealtimeChannel({
    name: 'courier-orders',
    table: 'orders',
    event: '*',
    onEvent: (payload) => {
      if (payload.eventType !== 'DELETE') {
        const row = payload.new as { id?: string } & Record<string, unknown>
        if (tracker.observe(row)) {
          const shortCode = row.short_code
          playSoundEvent('new_order')
          toast('Nuevo pedido disponible', {
            description:
              typeof shortCode === 'string'
                ? `Pedido #${shortCode} listo para recoger.`
                : 'Hay un pedido listo para recoger.',
          })
        }
      }
      reconcile()
      refresh()
    },
    onResync: () => {
      reconcile()
      refresh()
    },
  })

  return available
}
