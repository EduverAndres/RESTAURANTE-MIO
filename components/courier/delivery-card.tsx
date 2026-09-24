'use client'

import { ChevronRightIcon, ClockIcon, MapPinIcon } from 'lucide-react'
import Link from 'next/link'
import { AdvanceOrderButton } from '@/components/courier/advance-order-button'
import { OrderStatusBadge } from '@/components/orders/order-status-badge'
import { Button } from '@/components/ui/button'
import { formatEta } from '@/lib/courier/eta'
import type { CourierOrderSummary } from '@/lib/courier/orders'
import { formatCOP } from '@/lib/format'

const dateFormatter = new Intl.DateTimeFormat('es-CO', {
  day: 'numeric',
  month: 'short',
  hour: '2-digit',
  minute: '2-digit',
})

interface DeliveryCardProps {
  order: CourierOrderSummary
  /** History rows are read-only and more compact. */
  compact?: boolean
}

export function DeliveryCard({ order, compact = false }: DeliveryCardProps) {
  const eta = formatEta(order.estimatedAt)
  const showEta =
    !compact &&
    eta &&
    order.status !== 'delivered' &&
    order.status !== 'cancelled'

  return (
    <article
      aria-label={`Pedido #${order.shortCode}`}
      className="rounded-card border-border bg-card shadow-soft space-y-3 border p-4"
    >
      <header className="flex flex-wrap items-start justify-between gap-2">
        <div className="min-w-0">
          <p className="text-muted-foreground font-mono text-xs">
            #{order.shortCode} ·{' '}
            {dateFormatter.format(new Date(order.createdAt))}
          </p>
          <p className="truncate font-semibold">{order.storeName}</p>
        </div>
        <div className="flex items-center gap-2">
          <OrderStatusBadge status={order.status} />
          <span className="text-sm font-semibold tabular-nums">
            {formatCOP(order.deliveryFee)}
          </span>
        </div>
      </header>

      {!compact ? (
        <p className="text-muted-foreground flex items-start gap-1.5 text-sm">
          <MapPinIcon aria-hidden="true" className="mt-0.5 size-4 shrink-0" />
          <span>{order.addressLine ?? 'Dirección no disponible'}</span>
        </p>
      ) : null}

      {showEta ? (
        <p className="text-muted-foreground flex items-center gap-1.5 text-xs">
          <ClockIcon aria-hidden="true" className="size-3.5" />
          Llega alrededor de las {eta}
        </p>
      ) : null}

      {!compact ? (
        <div className="flex flex-wrap items-center gap-2">
          {/* The board only ever lists delivery orders (see app/courier/page.tsx). */}
          <AdvanceOrderButton
            orderId={order.id}
            status={order.status}
            orderType="delivery"
          />
          <Button asChild variant="outline" className="rounded-pill">
            <Link href={`/courier/${order.id}`}>
              Ver detalle
              <ChevronRightIcon aria-hidden="true" />
            </Link>
          </Button>
        </div>
      ) : null}
    </article>
  )
}
