'use client'

import { ChevronDownIcon } from 'lucide-react'
import {
  CorporateBadge,
  CorporateBillingDialog,
} from '@/components/dashboard/orders/corporate-billing-dialog'
import { RecordRefundDialog } from '@/components/refunds/record-refund-dialog'
import {
  OrderStatusBadge,
  PaymentStatusBadge,
} from '@/components/orders/order-status-badge'
import { Badge } from '@/components/ui/badge'
import { formatCOP } from '@/lib/format'
import { formatTimeCO } from '@/lib/format-date'
import {
  isCorporateOrder,
  itemsSummary,
  type BoardOrder,
} from '@/lib/orders/kanban'
import { ORDER_TYPE_LABELS } from '@/lib/orders/status'
import { supportWhatsAppUrl } from '@/lib/marketplace/support'
import { canRecordRefund, isRefundable } from '@/lib/refunds/plan'

interface HistorySectionProps {
  orders: BoardOrder[]
}

/**
 * Delivered and cancelled orders from today, collapsed by default.
 *
 * This is also where a refund is recorded. It is the merchant's only view of
 * a closed order, and a refund is by definition something that happens after
 * the order closed, so putting the control anywhere else would mean inventing
 * a screen nobody already opens.
 */
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
              <div className="min-w-0 flex-1 basis-56 space-y-0.5">
                <p className="flex flex-wrap items-center gap-x-2 gap-y-1 text-sm">
                  <span className="font-mono font-semibold">
                    #{order.short_code}
                  </span>
                  <Badge variant="outline" className="rounded-pill text-xs">
                    {ORDER_TYPE_LABELS[order.type]}
                  </Badge>
                  <span className="text-muted-foreground text-xs">
                    {formatTimeCO(order.created_at)}
                  </span>
                  {isCorporateOrder(order) ? <CorporateBadge /> : null}
                </p>
                <p className="text-muted-foreground truncate text-xs">
                  {order.customer_name ?? 'Cliente'} ·{' '}
                  {itemsSummary(order.items)}
                </p>
              </div>
              <div className="flex flex-wrap items-center gap-3">
                <OrderStatusBadge status={order.status} />
                {order.payment_status === 'refunded' ? (
                  <PaymentStatusBadge status={order.payment_status} />
                ) : null}
                <span className="text-sm font-semibold tabular-nums">
                  {formatCOP(order.total)}
                </span>
                {isCorporateOrder(order) && order.status !== 'cancelled' ? (
                  <CorporateBillingDialog
                    orderId={order.id}
                    shortCode={order.short_code}
                    size="xs"
                  />
                ) : null}
                {canRecordRefund(order, 'merchant') ? (
                  <RecordRefundDialog
                    orderId={order.id}
                    shortCode={order.short_code}
                    total={order.total}
                  />
                ) : isRefundable(order) ? (
                  <CashRefundHelp shortCode={order.short_code} />
                ) : null}
              </div>
            </li>
          ))}
        </ul>
      )}
    </details>
  )
}

/**
 * Where the refund button would be on a cash order. The merchant cannot
 * record it themselves (see `canRecordRefund`), so the closed order says who
 * can, and links to them when the support line is configured.
 */
function CashRefundHelp({ shortCode }: { shortCode: string }) {
  const url = supportWhatsAppUrl(
    `Hola, necesito registrar el reembolso del pedido en efectivo #${shortCode}.`,
  )
  if (!url) {
    return (
      <span className="text-muted-foreground text-xs">
        Reembolso en efectivo: lo registra Cerquita
      </span>
    )
  }
  return (
    <a
      href={url}
      target="_blank"
      rel="noopener noreferrer"
      className="text-primary-on-tint text-xs font-medium underline underline-offset-2"
    >
      Pedir reembolso a Cerquita
    </a>
  )
}
