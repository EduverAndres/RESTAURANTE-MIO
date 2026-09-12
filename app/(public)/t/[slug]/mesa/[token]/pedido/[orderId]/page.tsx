import { ChevronLeftIcon, UtensilsIcon } from 'lucide-react'
import type { Metadata } from 'next'
import { cookies } from 'next/headers'
import Link from 'next/link'
import { notFound } from 'next/navigation'
import { OrderTimeline } from '@/app/(protected)/orders/[id]/order-tracker'
import { GuestOrderRefresher } from '@/components/orders/guest-order-refresher'
import { OrderReceipt } from '@/components/orders/order-receipt'
import {
  OrderStatusBadge,
  PaymentStatusBadge,
} from '@/components/orders/order-status-badge'
import { Button } from '@/components/ui/button'
import { isUuid } from '@/lib/dashboard/active-store'
import { GUEST_ORDERS_COOKIE, hasGuestOrder } from '@/lib/orders/guest-orders'
import { reconcileWompiTransaction } from '@/lib/payments/wompi/reconcile'
import { createAdminClient } from '@/lib/supabase/admin'
import { createClient } from '@/lib/supabase/server'
import { tableEntryPath } from '@/lib/tables/qr'
import { fetchTableByToken } from '@/lib/tables/server'
import { TABLE_PAYMENT_LABELS } from '@/lib/validations/table-order'
import type { OrderStatus } from '@/types/app'

export const dynamic = 'force-dynamic'

const ORDER_SELECT =
  'id, short_code, status, type, table_number, subtotal, delivery_fee, tip, total, payment_method, payment_status, notes, estimated_at, accepted_at, preparing_at, ready_at, picked_up_at, delivered_at, cancelled_at, created_at, order_items(id, name_snapshot, unit_price, quantity, options, line_total)'

const TERMINAL: readonly OrderStatus[] = ['delivered', 'cancelled']

interface GuestOrderPageProps {
  params: Promise<{ slug: string; token: string; orderId: string }>
  searchParams: Promise<{ id?: string }>
}

/**
 * Loads the order through RLS first (logged-in customer). Anonymous guests
 * prove ownership with the httpOnly cookie written by placeTableOrder and
 * the row is then read with the service role; nothing else is ever shown.
 */
async function loadGuestOrder(orderId: string, storeId: string) {
  if (!isUuid(orderId)) return null
  const supabase = await createClient()
  const { data: visible } = await supabase
    .from('orders')
    .select(ORDER_SELECT)
    .eq('id', orderId)
    .eq('store_id', storeId)
    .eq('type', 'table')
    .maybeSingle()
  if (visible) return { order: visible, live: true }

  const cookieStore = await cookies()
  if (!hasGuestOrder(cookieStore.get(GUEST_ORDERS_COOKIE)?.value, orderId))
    return null
  try {
    const { data, error } = await createAdminClient()
      .from('orders')
      .select(ORDER_SELECT)
      .eq('id', orderId)
      .eq('store_id', storeId)
      .eq('type', 'table')
      .is('customer_id', null)
      .maybeSingle()
    if (error) throw error
    return data ? { order: data, live: false } : null
  } catch (error) {
    console.error('Failed to load guest order', error)
    return null
  }
}

export async function generateMetadata({
  params,
}: GuestOrderPageProps): Promise<Metadata> {
  const { orderId } = await params
  return { title: isUuid(orderId) ? 'Tu pedido' : 'Pedido' }
}

function isTablePaymentMethod(
  value: string,
): value is keyof typeof TABLE_PAYMENT_LABELS {
  return value in TABLE_PAYMENT_LABELS
}

export default async function GuestOrderPage({
  params,
  searchParams,
}: GuestOrderPageProps) {
  const { slug, token, orderId } = await params
  const resolved = await fetchTableByToken(slug, token)
  if (!resolved) notFound()
  let loaded = await loadGuestOrder(orderId, resolved.store.id)
  if (!loaded) notFound()

  // Wompi redirects back with `?id=<transaction_id>`; reconcile it here in
  // case the webhook has not arrived yet (e.g. local dev with no public URL).
  const { id: transactionId } = await searchParams
  if (
    transactionId &&
    loaded.order.payment_method === 'wompi' &&
    loaded.order.payment_status === 'pending'
  ) {
    await reconcileWompiTransaction(loaded.order.id, transactionId)
    loaded = (await loadGuestOrder(orderId, resolved.store.id)) ?? loaded
  }

  const { order, live } = loaded
  const terminal = TERMINAL.includes(order.status)
  const payment = isTablePaymentMethod(order.payment_method)
    ? TABLE_PAYMENT_LABELS[order.payment_method].label
    : order.payment_method

  return (
    <div className="container-page py-8 lg:py-12">
      <Link
        href={tableEntryPath(slug, token)}
        className="text-muted-foreground hover:text-foreground mb-4 inline-flex items-center gap-1 text-sm"
      >
        <ChevronLeftIcon aria-hidden="true" className="size-4" />
        Volver al menú
      </Link>

      <header className="mb-8 flex flex-wrap items-start justify-between gap-4">
        <div>
          <p className="text-muted-foreground font-mono text-sm">
            #{order.short_code}
          </p>
          <h1 className="font-display text-3xl font-semibold tracking-tight sm:text-4xl">
            {resolved.store.name}
          </h1>
          <p className="text-muted-foreground mt-1 flex flex-wrap items-center gap-1.5 text-sm">
            <UtensilsIcon aria-hidden="true" className="size-4" />
            Mesa {order.table_number ?? resolved.table.number} · {payment}
            <PaymentStatusBadge status={order.payment_status} />
          </p>
        </div>
        <OrderStatusBadge status={order.status} className="text-sm" />
      </header>

      <div className="grid gap-8 lg:grid-cols-[1.1fr_1fr]">
        <div className="space-y-6">
          <OrderTimeline
            live={live}
            initial={{
              id: order.id,
              status: order.status,
              type: order.type,
              estimated_at: order.estimated_at,
              accepted_at: order.accepted_at,
              preparing_at: order.preparing_at,
              ready_at: order.ready_at,
              picked_up_at: order.picked_up_at,
              delivered_at: order.delivered_at,
              cancelled_at: order.cancelled_at,
              created_at: order.created_at,
            }}
          />
          <GuestOrderRefresher active={!live && !terminal} />
          <Button asChild variant="outline" className="rounded-pill">
            <Link href={tableEntryPath(slug, token)}>Pedir algo más</Link>
          </Button>
        </div>

        <aside className="rounded-card border-border bg-card shadow-soft space-y-4 border p-5">
          <h2 className="font-display text-2xl font-semibold">Detalle</h2>
          <OrderReceipt
            items={order.order_items ?? []}
            subtotal={Number(order.subtotal)}
            deliveryFee={Number(order.delivery_fee)}
            tip={Number(order.tip)}
            total={Number(order.total)}
            notes={order.notes}
            footer={
              <p className="text-muted-foreground text-xs">
                Guarda este enlace: es la forma de volver a ver tu pedido.
              </p>
            }
          />
        </aside>
      </div>
    </div>
  )
}
