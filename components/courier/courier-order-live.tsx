'use client'

import { useEffect, useState } from 'react'
import {
  useRealtimeChannel,
  useRealtimeRefresh,
} from '@/components/providers/realtime-provider'
import { ORDER_STATUS_LABELS } from '@/lib/orders/status'
import type { OrderStatus } from '@/types/app'

interface CourierOrderLiveProps {
  orderId: string
  /** Status as the server rendered it. */
  status: OrderStatus
}

/**
 * Keeps the courier's delivery detail in sync and announces status changes.
 *
 * The page is a server component: the event triggers a refresh rather than
 * becoming the rendered truth, because the map, the route and the advance
 * button all derive from server data. The status is mirrored locally only so
 * the live region can speak before the refresh lands.
 *
 * The channel name matches the customer tracker's, so the two share one
 * subscription whenever they ever end up on the same screen.
 */
export function CourierOrderLive({ orderId, status }: CourierOrderLiveProps) {
  const refresh = useRealtimeRefresh()
  const [current, setCurrent] = useState(status)

  useEffect(() => setCurrent(status), [status])

  useRealtimeChannel({
    name: `order-${orderId}`,
    table: 'orders',
    event: 'UPDATE',
    filter: `id=eq.${orderId}`,
    onEvent: (payload) => {
      const next = (payload.new as { status?: OrderStatus }).status
      if (next && next in ORDER_STATUS_LABELS) setCurrent(next)
      refresh()
    },
  })

  return (
    <p role="status" aria-live="polite" className="sr-only">
      Estado del pedido: {ORDER_STATUS_LABELS[current]}.
    </p>
  )
}
