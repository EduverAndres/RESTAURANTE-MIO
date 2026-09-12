'use client'

import { useRouter } from 'next/navigation'
import { useCallback, useEffect, useMemo, useState } from 'react'
import { toast } from 'sonner'
import { updateOrderStatus } from '@/app/dashboard/actions'
import { BoardColumn } from '@/components/dashboard/orders/board-column'
import { HistorySection } from '@/components/dashboard/orders/history-section'
import { playNewOrderChime } from '@/components/dashboard/orders/new-order-chime'
import {
  useRealtimeChannel,
  useRealtimeRefresh,
} from '@/components/providers/realtime-provider'
import { KANBAN_SHORTCUT_HINT } from '@/lib/a11y/kanban-shortcuts'
import {
  KANBAN_COLUMNS,
  groupOrdersForBoard,
  type BoardOrder,
} from '@/lib/orders/kanban'
import { ORDER_STATUS_LABELS } from '@/lib/orders/status'
import type { Order, OrderStatus } from '@/types/app'

interface OrderBoardProps {
  storeId: string
  initial: BoardOrder[]
}

const CLOCK_TICK_MS = 30_000

/**
 * One sentence for every move, whoever made it.
 *
 * The board has a single live region, so a transition the merchant performed
 * and the realtime echo that follows it must read identically — otherwise the
 * region changes twice and the same move is announced twice in different
 * words. Naming the destination column is the point: "moved" is the part a
 * keyboard user cannot see happen.
 */
function movedAnnouncement(shortCode: string, to: OrderStatus): string {
  const column = KANBAN_COLUMNS.find((entry) => entry.status === to)
  return column
    ? `Pedido ${shortCode} movido a ${column.title}.`
    : `Pedido ${shortCode}: ${ORDER_STATUS_LABELS[to]}.`
}

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
  const refresh = useRealtimeRefresh()
  const [orders, setOrders] = useState(initial)
  const [pendingIds, setPendingIds] = useState<ReadonlySet<string>>(
    () => new Set(),
  )
  // One live region for the whole board: twenty cards each announcing
  // themselves would be worse than none.
  const [announcement, setAnnouncement] = useState('')

  useEffect(() => setOrders(initial), [initial])

  useRealtimeChannel({
    name: `store-orders-${storeId}`,
    table: 'orders',
    event: '*',
    filter: `store_id=eq.${storeId}`,
    onEvent: (payload) => {
      if (payload.eventType === 'INSERT') {
        const inserted = payload.new as unknown as Order
        if (inserted.status === 'pending') {
          playNewOrderChime()
          toast(`Nuevo pedido #${inserted.short_code}`, {
            description: 'Acéptalo desde la columna Nuevos.',
          })
          setAnnouncement(
            `Nuevo pedido ${inserted.short_code} en la columna Nuevos.`,
          )
        }
      } else if (payload.eventType === 'UPDATE') {
        const updated = payload.new as unknown as Order
        setOrders((current) =>
          current.map((order) =>
            order.id === updated.id
              ? { ...order, status: updated.status }
              : order,
          ),
        )
        setAnnouncement(movedAnnouncement(updated.short_code, updated.status))
      }
      // Items and customer names only come from the server query.
      refresh()
    },
  })

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
        setAnnouncement(movedAnnouncement(previous.short_code, to))
        // Realtime may be disconnected; refresh so the server state lands.
        router.refresh()
      })
    },
    [orders, router],
  )

  const board = useMemo(() => groupOrdersForBoard(orders), [orders])

  return (
    <div className="space-y-6">
      {/*
        The board's single live region. Twenty cards each announcing
        themselves would be worse than none, so every move — button, card
        menu or keyboard shortcut — reports here and nowhere else.
      */}
      <p role="status" aria-live="polite" className="sr-only">
        {announcement}
      </p>
      <p className="text-muted-foreground text-xs">{KANBAN_SHORTCUT_HINT}</p>
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
