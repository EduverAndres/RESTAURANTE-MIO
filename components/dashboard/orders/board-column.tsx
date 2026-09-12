'use client'

import { OrderCard } from '@/components/dashboard/orders/order-card'
import { orderElapsedTone } from '@/lib/orders/elapsed-tone'
import type { BoardOrder, KanbanColumn } from '@/lib/orders/kanban'
import { cn } from '@/lib/utils'
import type { OrderStatus } from '@/types/app'

interface BoardColumnProps {
  column: KanbanColumn
  orders: BoardOrder[]
  now: Date
  pendingIds: ReadonlySet<string>
  onTransition: (orderId: string, to: OrderStatus) => void
}

export function BoardColumn({
  column,
  orders,
  now,
  pendingIds,
  onTransition,
}: BoardColumnProps) {
  const headingId = `column-${column.status}`
  const late = orders.filter(
    (order) => orderElapsedTone(order.status, order.created_at, now) === 'late',
  ).length

  return (
    <section
      aria-labelledby={headingId}
      className="flex w-72 shrink-0 flex-col gap-3 lg:w-auto lg:min-w-0"
    >
      <header className="flex items-center justify-between gap-2 px-1">
        <h2 id={headingId} className="text-sm font-semibold">
          {column.title}
        </h2>
        <span className="flex items-center gap-1">
          {/*
            The column's own alarm. One glance across the board answers
            "where is the fire?" before a single card has been read.
          */}
          {late > 0 ? (
            <span className="rounded-pill bg-destructive text-destructive-foreground px-2 py-0.5 text-xs font-semibold tabular-nums">
              {late}
              <span className="sr-only"> con retraso</span>
            </span>
          ) : null}
          <span
            className={cn(
              'rounded-pill px-2 py-0.5 text-xs font-semibold tabular-nums',
              column.status === 'pending' && orders.length > 0
                ? 'bg-primary text-primary-foreground'
                : 'bg-muted text-muted-foreground',
            )}
          >
            {orders.length}
          </span>
        </span>
      </header>
      <div className="rounded-card bg-muted/40 flex min-h-40 flex-col gap-3 p-2">
        {orders.length === 0 ? (
          <p className="text-muted-foreground px-2 py-6 text-center text-xs">
            Sin pedidos
          </p>
        ) : (
          orders.map((order) => (
            <OrderCard
              key={order.id}
              order={order}
              now={now}
              pending={pendingIds.has(order.id)}
              onTransition={onTransition}
            />
          ))
        )}
      </div>
    </section>
  )
}
