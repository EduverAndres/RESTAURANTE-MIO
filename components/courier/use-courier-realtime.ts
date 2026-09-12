'use client'

import { useRouter } from 'next/navigation'
import { useEffect } from 'react'
import { toast } from 'sonner'
import { createClient } from '@/lib/supabase/client'
import type { Order } from '@/types/app'

function isPoolOrder(row: Partial<Order> | null | undefined): boolean {
  return (
    !!row &&
    row.courier_id === null &&
    row.status === 'ready' &&
    row.type === 'delivery'
  )
}

/**
 * Refreshes the courier lists whenever an order the courier may see changes.
 * Realtime respects RLS, so the stream already contains only the pool and
 * the courier's own orders; no column filter is needed.
 */
export function useCourierRealtime() {
  const router = useRouter()

  useEffect(() => {
    const supabase = createClient()
    const channel = supabase
      .channel('courier-orders')
      .on(
        'postgres_changes',
        { event: '*', schema: 'public', table: 'orders' },
        (payload) => {
          const next = payload.new as Partial<Order>
          const previous = payload.old as Partial<Order>
          if (
            payload.eventType !== 'DELETE' &&
            isPoolOrder(next) &&
            !isPoolOrder(previous)
          ) {
            toast('Nuevo pedido disponible', {
              description: next.short_code
                ? `Pedido #${next.short_code} listo para recoger.`
                : 'Hay un pedido listo para recoger.',
            })
          }
          router.refresh()
        },
      )
      .subscribe()
    return () => {
      supabase.removeChannel(channel)
    }
  }, [router])
}
