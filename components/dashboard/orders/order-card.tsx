'use client'

import { ClockIcon, StickyNoteIcon, UserRoundIcon } from 'lucide-react'
import { OrderActions } from '@/components/dashboard/orders/order-actions'
import { Badge } from '@/components/ui/badge'
import { formatCOP } from '@/lib/format'
import {
  elapsedLabel,
  itemsSummary,
  type BoardOrder,
} from '@/lib/orders/kanban'
import { ORDER_TYPE_LABELS } from '@/lib/orders/status'
import { cn } from '@/lib/utils'
import type { OrderStatus } from '@/types/app'

interface OrderCardProps {
  order: BoardOrder
  now: Date
  pending: boolean
  onTransition: (orderId: string, to: OrderStatus) => void
}

const LATE_AFTER_MINUTES = 10

export function OrderCard({
  order,
  now,
  pending,
  onTransition,
}: OrderCardProps) {
  const ageMinutes =
    (now.getTime() - new Date(order.created_at).getTime()) / 60_000
  const late = order.status === 'pending' && ageMinutes >= LATE_AFTER_MINUTES

  return (
    <article
      aria-label={`Pedido #${order.short_code}`}
      className={cn(
        'rounded-card border-border bg-card shadow-soft space-y-3 border p-4',
        late && 'border-destructive/40',
      )}
    >
      <header className="flex items-start justify-between gap-2">
        <div className="min-w-0 space-y-1">
          <p className="font-mono text-sm font-semibold">#{order.short_code}</p>
          <Badge variant="outline" className="rounded-pill text-[10px]">
            {ORDER_TYPE_LABELS[order.type]}
            {order.type === 'table' && order.table_number
              ? ` ${order.table_number}`
              : ''}
          </Badge>
        </div>
        <p
          className={cn(
            'flex shrink-0 items-center gap-1 text-xs',
            late ? 'text-destructive font-medium' : 'text-muted-foreground',
          )}
        >
          <ClockIcon aria-hidden="true" className="size-3.5" />
          {elapsedLabel(order.created_at, now)}
        </p>
      </header>

      <div className="space-y-1.5 text-sm">
        <p className="text-muted-foreground flex items-center gap-1.5 text-xs">
          <UserRoundIcon aria-hidden="true" className="size-3.5" />
          <span className="truncate">{order.customer_name ?? 'Cliente'}</span>
        </p>
        <p className="line-clamp-2">{itemsSummary(order.items)}</p>
        {order.notes ? (
          <p className="text-muted-foreground flex items-start gap-1.5 text-xs">
            <StickyNoteIcon
              aria-hidden="true"
              className="mt-0.5 size-3.5 shrink-0"
            />
            <span className="line-clamp-2">{order.notes}</span>
          </p>
        ) : null}
        <p className="font-semibold tabular-nums">{formatCOP(order.total)}</p>
      </div>

      <OrderActions
        shortCode={order.short_code}
        status={order.status}
        type={order.type}
        pending={pending}
        onTransition={(to) => onTransition(order.id, to)}
      />
    </article>
  )
}
