'use client'

import { ChevronDownIcon } from 'lucide-react'
import { OrderStatusBadge } from '@/components/orders/order-status-badge'
import { Badge } from '@/components/ui/badge'
import { formatCOP } from '@/lib/format'
import { itemsSummary, type BoardOrder } from '@/lib/orders/kanban'
import { ORDER_TYPE_LABELS } from '@/lib/orders/status'

interface HistorySectionProps {
  orders: BoardOrder[]
}

const timeFormatter = new Intl.DateTimeFormat('es-CO', {
  hour: '2-digit',
  minute: '2-digit',
})

/** Delivered and cancelled orders from today, collapsed by default. */
export function HistorySection({ orders }: HistorySectionProps) {
  return (
    <details className="group rounded-card border-border bg-card shadow-1 border">
      <summary className="flex cursor-pointer list-none items-center justify-between gap-3 px-4 py-3 select-none">
        <span className="text-sm font-semibold">
          Historial de hoy{' '}
          <span className="text-muted-foreground font-normal">
            ({orders.length})
          </span>
        </span>
        <ChevronDownIcon
          aria-hidden="true"
          className="text-muted-foreground size-4 transition-transform group-open:rotate-180"
        />
      </summary>
      {orders.length === 0 ? (
        <p className="text-muted-foreground border-t px-4 py-6 text-center text-sm">
          Todavía no hay pedidos cerrados hoy.
        </p>
      ) : (
        <ul className="divide-border divide-y border-t">
          {orders.map((order) => (
            <li
              key={order.id}
              className="flex flex-wrap items-center justify-between gap-3 px-4 py-3"
            >
              <div className="min-w-0 space-y-0.5">
                <p className="flex items-center gap-2 text-sm">
                  <span className="font-mono font-semibold">
                    #{order.short_code}
                  </span>
                  <Badge variant="outline" className="rounded-pill text-[10px]">
                    {ORDER_TYPE_LABELS[order.type]}
                  </Badge>
                  <span className="text-muted-foreground text-xs">
                    {timeFormatter.format(new Date(order.created_at))}
                  </span>
                </p>
                <p className="text-muted-foreground truncate text-xs">
                  {order.customer_name ?? 'Cliente'} ·{' '}
                  {itemsSummary(order.items)}
                </p>
              </div>
              <div className="flex items-center gap-3">
                <OrderStatusBadge status={order.status} />
                <span className="text-sm font-semibold tabular-nums">
                  {formatCOP(order.total)}
                </span>
              </div>
            </li>
          ))}
        </ul>
      )}
    </details>
  )
}
