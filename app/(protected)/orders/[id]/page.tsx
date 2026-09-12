import {
  ChevronLeftIcon,
  MapPinIcon,
  MessageCircleIcon,
  StoreIcon,
} from 'lucide-react'
import type { Metadata } from 'next'
import Link from 'next/link'
import { notFound } from 'next/navigation'
import { CancelOrderButton } from './cancel-order-button'
import { OrderTimeline } from './order-tracker'
import { ReviewForm } from './review-form'
import { DeliveryMap } from '@/components/orders/delivery-map'
import { OrderReceipt } from '@/components/orders/order-receipt'
import {
  OrderStatusBadge,
  PaymentStatusBadge,
} from '@/components/orders/order-status-badge'
import { Button } from '@/components/ui/button'
import { requireUser } from '@/lib/auth'
import { fetchCourierPosition, fetchProfileName } from '@/lib/courier/server'
import { isUuid } from '@/lib/dashboard/active-store'
import { latLngOf, type LatLng } from '@/lib/geo'
import { ORDER_TYPE_LABELS } from '@/lib/orders/status'
import { buildCustomerInquiry, buildWhatsAppUrl } from '@/lib/orders/whatsapp'
import { reconcileWompiTransaction } from '@/lib/payments/wompi/reconcile'
import { estimateRoute } from '@/lib/routing'
import { createClient } from '@/lib/supabase/server'
import type { OrderStatus } from '@/types/app'

const TRACKABLE: readonly OrderStatus[] = ['ready', 'picked_up']

type FetchedOrder = NonNullable<Awaited<ReturnType<typeof fetchOrder>>>

interface DeliveryTracking {
  courierId: string | null
  courierName: string | null
  store: LatLng | null
  customer: LatLng | null
  courier: LatLng | null
  path: [number, number][]
}

/**
 * Live-tracking inputs for an active delivery. Routing runs here (server)
 * so the browser never calls the provider; any failure just drops the line.
 */
async function loadDeliveryTracking(
  order: FetchedOrder,
): Promise<DeliveryTracking | null> {
  if (order.type !== 'delivery' || !TRACKABLE.includes(order.status)) {
    return null
  }
  const supabase = await createClient()
  const [courierName, position] = await Promise.all([
    fetchProfileName(order.courier_id),
    fetchCourierPosition(supabase, order.courier_id),
  ])
  const store = latLngOf(order.stores)
  const customer = latLngOf(order.addresses)
  const courier = position ? { lat: position.lat, lng: position.lng } : null
  const origin = order.status === 'picked_up' && courier ? courier : store

  let path: [number, number][] = []
  if (order.courier_id && origin && customer) {
    try {
      path = (await estimateRoute(origin, customer)).geometry
    } catch (error) {
      console.error('Failed to route customer tracking', error)
    }
  }
  return {
    courierId: order.courier_id,
    courierName,
    store,
    customer,
    courier,
    path,
  }
}

export const dynamic = 'force-dynamic'

interface OrderPageProps {
  params: Promise<{ id: string }>
  searchParams: Promise<{ id?: string }>
}

const PAYMENT_LABELS: Record<string, string> = {
  cash: 'Efectivo',
  mock: 'Tarjeta de prueba',
  wompi: 'Wompi',
  mercadopago: 'Mercado Pago',
}

async function fetchOrder(id: string) {
  if (!isUuid(id)) return null
  const supabase = await createClient()
  const { data } = await supabase
    .from('orders')
    .select(
      '*, stores(name, slug, whatsapp_phone, address, lat, lng), addresses(label, line1, line2, lat, lng), order_items(id, name_snapshot, unit_price, quantity, options, line_total), reviews(id, rating)',
    )
    .eq('id', id)
    .maybeSingle()
  return data
}

export async function generateMetadata({
  params,
}: OrderPageProps): Promise<Metadata> {
  const { id } = await params
  const order = await fetchOrder(id)
  return { title: order ? `Pedido #${order.short_code}` : 'Pedido' }
}

export default async function OrderPage({
  params,
  searchParams,
}: OrderPageProps) {
  const { id } = await params
  const { profile, user } = await requireUser(`/orders/${id}`)
  let order = await fetchOrder(id)
  if (!order) notFound()

  // Wompi redirects back with `?id=<transaction_id>`; reconcile it here in
  // case the webhook has not arrived yet (e.g. local dev with no public URL).
  const { id: transactionId } = await searchParams
  if (
    transactionId &&
    order.payment_method === 'wompi' &&
    order.payment_status === 'pending'
  ) {
    await reconcileWompiTransaction(order.id, transactionId)
    order = (await fetchOrder(id)) ?? order
  }

  const tracking = await loadDeliveryTracking(order)
  const store = order.stores
  const whatsappUrl = buildWhatsAppUrl(
    store?.whatsapp_phone,
    buildCustomerInquiry(order.short_code, store?.name ?? 'restaurante'),
  )
  // reviews.order_id is unique, so the embed may come back as one object.
  const reviewed = Array.isArray(order.reviews)
    ? order.reviews.length > 0
    : order.reviews !== null
  const customerName = profile?.full_name ?? user.email ?? ''

  return (
    <div className="container-page py-8 lg:py-12">
      <Link
        href="/account#pedidos"
        className="text-muted-foreground hover:text-foreground mb-4 inline-flex items-center gap-1 text-sm"
      >
        <ChevronLeftIcon aria-hidden="true" className="size-4" />
        Mis pedidos
      </Link>

      <header className="mb-8 flex flex-wrap items-start justify-between gap-4">
        <div>
          <p className="text-muted-foreground font-mono text-sm">
            #{order.short_code}
          </p>
          <h1 className="font-display text-3xl font-semibold tracking-tight sm:text-4xl">
            {store?.name ?? 'Pedido'}
          </h1>
          <p className="text-muted-foreground mt-1 flex flex-wrap items-center gap-1.5 text-sm">
            {ORDER_TYPE_LABELS[order.type]} ·{' '}
            {PAYMENT_LABELS[order.payment_method] ?? order.payment_method}
            <PaymentStatusBadge status={order.payment_status} />
          </p>
        </div>
        <OrderStatusBadge status={order.status} className="text-sm" />
      </header>

      <div className="grid gap-8 lg:grid-cols-[1.1fr_1fr]">
        <div className="space-y-6">
          <OrderTimeline
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

          {tracking ? (
            <DeliveryMap
              courierId={tracking.courierId}
              courierName={tracking.courierName}
              store={tracking.store}
              customer={tracking.customer}
              initialCourier={tracking.courier}
              path={tracking.path}
            />
          ) : null}

          <div className="flex flex-wrap gap-2">
            {whatsappUrl ? (
              <Button
                asChild
                className="rounded-pill bg-[#25D366] text-white hover:bg-[#1ebe5b]"
              >
                <a href={whatsappUrl} target="_blank" rel="noopener noreferrer">
                  <MessageCircleIcon aria-hidden="true" />
                  Escribir al restaurante
                </a>
              </Button>
            ) : null}
            {store?.slug ? (
              <Button asChild variant="outline" className="rounded-pill">
                <Link href={`/t/${store.slug}`}>
                  <StoreIcon aria-hidden="true" />
                  Volver a pedir
                </Link>
              </Button>
            ) : null}
            {order.status === 'pending' ? (
              <CancelOrderButton orderId={order.id} />
            ) : null}
          </div>

          {order.status === 'delivered' && !reviewed ? (
            <ReviewForm
              orderId={order.id}
              storeName={store?.name ?? 'el restaurante'}
            />
          ) : null}
          {reviewed ? (
            <p className="rounded-card bg-muted/60 text-muted-foreground p-4 text-sm">
              Gracias por valorar este pedido.
            </p>
          ) : null}
        </div>

        <aside className="rounded-card border-border bg-card shadow-soft space-y-4 border p-5">
          <h2 className="font-display text-2xl font-semibold">Detalle</h2>
          {order.type === 'delivery' && order.addresses ? (
            <p className="flex items-start gap-2 text-sm">
              <MapPinIcon
                aria-hidden="true"
                className="text-primary mt-0.5 size-4"
              />
              <span>
                <span className="block font-medium">
                  {order.addresses.label ?? 'Dirección'}
                </span>
                <span className="text-muted-foreground block">
                  {order.addresses.line1}
                  {order.addresses.line2 ? `, ${order.addresses.line2}` : ''}
                </span>
              </span>
            </p>
          ) : null}
          {order.type === 'pickup' && store?.address ? (
            <p className="flex items-start gap-2 text-sm">
              <StoreIcon
                aria-hidden="true"
                className="text-primary mt-0.5 size-4"
              />
              <span>
                <span className="block font-medium">Recoger en</span>
                <span className="text-muted-foreground block">
                  {store.address}
                </span>
              </span>
            </p>
          ) : null}

          <OrderReceipt
            items={order.order_items ?? []}
            subtotal={Number(order.subtotal)}
            deliveryFee={Number(order.delivery_fee)}
            tip={Number(order.tip)}
            total={Number(order.total)}
            notes={order.notes}
            footer={
              <p className="text-muted-foreground text-xs">
                Pedido a nombre de {customerName}.
              </p>
            }
          />
        </aside>
      </div>
    </div>
  )
}
