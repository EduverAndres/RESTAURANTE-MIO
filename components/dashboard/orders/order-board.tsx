'use client'

import { useRouter } from 'next/navigation'
import { useCallback, useEffect, useMemo, useState } from 'react'
import { toast } from 'sonner'
import { updateOrderStatus } from '@/app/dashboard/actions'
import { BoardColumn } from '@/components/dashboard/orders/board-column'
import { HistorySection } from '@/components/dashboard/orders/history-section'
import { playNewOrderChime } from '@/components/dashboard/orders/new-order-chime'
import {
  KANBAN_COLUMNS,
  groupOrdersForBoard,
  type BoardOrder,
} from '@/lib/orders/kanban'
import { ORDER_STATUS_LABELS } from '@/lib/orders/status'
import { createClient } from '@/lib/supabase/client'
import type { Order, OrderStatus } from '@/types/app'

interface OrderBoardProps {
  storeId: string
  initial: BoardOrder[]
}

const CLOCK_TICK_MS = 30_000

function useNow(): Date {
  const [now, setNow] = useState(() => new Date())
  useEffect(() => {
    const timer = setInterval(() => setNow(new Date()), CLOCK_TICK_MS)
    return () => clearInterval(timer)
  }, [])
  return now
}

/**
 * Client container for the Kanban: local order state, realtime sync for the
 * active store and the status transition action with optimistic updates.
 */
export function OrderBoard({ storeId, initial }: OrderBoardProps) {
  const router = useRouter()
  const now = useNow()
  const [orders, setOrders] = useState(initial)
  const [pendingIds, setPendingIds] = useState<ReadonlySet<string>>(
    () => new Set(),
  )

  useEffect(() => setOrders(initial), [initial])

  useEffect(() => {
    const supabase = createClient()
    const channel = supabase
      .channel(`store-orders-${storeId}`)
      .on(
        'postgres_changes',
        {
          event: '*',
          schema: 'public',
          table: 'orders',
          filter: `store_id=eq.${storeId}`,
        },
        (payload) => {
          if (payload.eventType === 'INSERT') {
            const inserted = payload.new as Order
            if (inserted.status === 'pending') {
              playNewOrderChime()
              toast(`Nuevo pedido #${inserted.short_code}`, {
                description: 'Acéptalo desde la columna Nuevos.',
              })
            }
          } else if (payload.eventType === 'UPDATE') {
            const updated = payload.new as Order
            setOrders((current) =>
              current.map((order) =>
                order.id === updated.id
                  ? { ...order, status: updated.status }
                  : order,
              ),
            )
          }
          // Items and customer names only come from the server query.
          router.refresh()
        },
      )
      .subscribe()
    return () => {
      supabase.removeChannel(channel)
    }
  }, [storeId, router])

  const transition = useCallback(
    (orderId: string, to: OrderStatus) => {
      const previous = orders.find((order) => order.id === orderId)
      if (!previous) return
      setPendingIds((current) => new Set(current).add(orderId))
      setOrders((current) =>
        current.map((order) =>
          order.id === orderId ? { ...order, status: to } : order,
        ),
      )
      void updateOrderStatus(orderId, to).then((result) => {
        setPendingIds((current) => {
          const next = new Set(current)
          next.delete(orderId)
          return next
        })
        if (!result.ok) {
          setOrders((current) =>
            current.map((order) =>
              order.id === orderId
                ? { ...order, status: previous.status }
                : order,
            ),
          )
          toast.error(result.error)
          router.refresh()
          return
        }
        toast.success(
          `Pedido #${previous.short_code}: ${ORDER_STATUS_LABELS[to]}.`,
        )
        // Realtime may be disconnected; refresh so the server state lands.
        router.refresh()
      })
    },
    [orders, router],
  )

  const board = useMemo(() => groupOrdersForBoard(orders), [orders])

  return (
    <div className="space-y-6">
      <div className="-mx-4 overflow-x-auto px-4 pb-2 sm:-mx-6 sm:px-6 lg:mx-0 lg:overflow-visible lg:px-0">
        <div className="flex gap-4 lg:grid lg:grid-cols-5">
          {KANBAN_COLUMNS.map((column) => (
            <BoardColumn
              key={column.status}
              column={column}
              orders={board.columns[column.status]}
              now={now}
              pendingIds={pendingIds}
              onTransition={transition}
            />
          ))}
        </div>
      </div>
      <HistorySection orders={board.history} />
    </div>
  )
}
