import { ChevronLeftIcon, ClockIcon } from 'lucide-react'
import type { Metadata } from 'next'
import Link from 'next/link'
import { notFound } from 'next/navigation'
import { AdvanceOrderButton } from '@/components/courier/advance-order-button'
import { CourierOrderDetails } from '@/components/courier/courier-order-details'
import { CourierOrderLive } from '@/components/courier/courier-order-live'
import { CourierOrderMap } from '@/components/courier/courier-order-map'
import { OrderStatusBadge } from '@/components/orders/order-status-badge'
import { requireRole } from '@/lib/auth'
import { formatEta } from '@/lib/courier/eta'
import { formatAddressLine } from '@/lib/courier/orders'
import { fetchAddressesById, fetchCourierPosition } from '@/lib/courier/server'
import { isUuid } from '@/lib/dashboard/active-store'
import { formatCOP } from '@/lib/format'
import { latLngOf, type LatLng } from '@/lib/geo'
import { estimateRoute, type RouteEstimate } from '@/lib/routing'
import { createClient } from '@/lib/supabase/server'

export const dynamic = 'force-dynamic'

interface CourierOrderPageProps {
  params: Promise<{ id: string }>
}

export const metadata: Metadata = { title: 'Detalle de entrega' }

async function fetchAssignedOrder(id: string, courierId: string) {
  if (!isUuid(id)) return null
  const supabase = await createClient()
  const { data } = await supabase
    .from('orders')
    .select(
      'id, short_code, status, type, notes, total, delivery_fee, estimated_at, payment_method, payment_status, address_id, customer_id, stores(name, address, lat, lng, whatsapp_phone), order_items(id, name_snapshot, quantity, options), customer:profiles!orders_customer_id_fkey(full_name, phone)',
    )
    .eq('id', id)
    .eq('courier_id', courierId)
    .maybeSingle()
  return data
}

/** Routing is server-only; failures simply leave the map without a line. */
async function safeRoute(
  from: LatLng | null,
  to: LatLng | null,
): Promise<RouteEstimate | null> {
  if (!from || !to) return null
  try {
    return await estimateRoute(from, to)
  } catch (error) {
    console.error('Failed to route courier order', error)
    return null
  }
}

export default async function CourierOrderPage({
  params,
}: CourierOrderPageProps) {
  const { id } = await params
  const { user } = await requireRole(['courier', 'admin'], `/courier/${id}`)
  const order = await fetchAssignedOrder(id, user.id)
  if (!order) notFound()

  const supabase = await createClient()
  const [addresses, position] = await Promise.all([
    fetchAddressesById([order.address_id]),
    fetchCourierPosition(supabase, user.id),
  ])
  const address = order.address_id
    ? (addresses.get(order.address_id) ?? null)
    : null

  const store = latLngOf(order.stores)
  const customer = latLngOf(address)
  const courier = position ? { lat: position.lat, lng: position.lng } : null
  const finished = order.status === 'delivered' || order.status === 'cancelled'
  // After pickup the relevant leg starts at the courier; before, at the store.
  const origin = order.status === 'picked_up' && courier ? courier : store
  const route = finished ? null : await safeRoute(origin, customer)
  const eta = formatEta(order.estimated_at)

  return (
    <div className="mx-auto max-w-4xl space-y-6">
      <CourierOrderLive orderId={order.id} status={order.status} />
      <Link
        href="/courier"
        className="text-muted-foreground hover:text-foreground inline-flex items-center gap-1 text-sm"
      >
        <ChevronLeftIcon aria-hidden="true" className="size-4" />
        Mis entregas
      </Link>

      <header className="flex flex-wrap items-start justify-between gap-4">
        <div>
          <p className="text-muted-foreground font-mono text-sm">
            #{order.short_code}
          </p>
          <h1 className="font-display text-3xl font-semibold tracking-tight sm:text-4xl">
            {order.stores?.name ?? 'Entrega'}
          </h1>
          <p className="text-muted-foreground mt-1 text-sm">
            Ganas {formatCOP(Number(order.delivery_fee))}
            {eta && !finished ? (
              <>
                {' '}
                · <ClockIcon
                  aria-hidden="true"
                  className="inline size-3.5"
                />{' '}
                Llega alrededor de las {eta}
              </>
            ) : null}
          </p>
        </div>
        <OrderStatusBadge status={order.status} className="text-sm" />
      </header>

      <div className="grid gap-8 lg:grid-cols-[1.1fr_1fr]">
        <div className="space-y-4">
          <CourierOrderMap
            courierId={user.id}
            status={order.status}
            store={store}
            customer={customer}
            initialCourier={position}
            path={route?.geometry ?? []}
            routeKm={route?.distanceKm ?? null}
            routeMin={route?.durationMin ?? null}
          />
          <AdvanceOrderButton
            orderId={order.id}
            status={order.status}
            orderType={order.type}
            className="h-11 w-full text-base sm:w-auto"
          />
        </div>

        <aside className="rounded-card border-border bg-card shadow-soft border p-5">
          <CourierOrderDetails
            shortCode={order.short_code}
            storeName={order.stores?.name ?? 'Restaurante'}
            storeAddress={order.stores?.address ?? null}
            storeWhatsApp={order.stores?.whatsapp_phone ?? null}
            customerName={order.customer?.full_name ?? null}
            customerPhone={order.customer?.phone ?? null}
            addressLine={formatAddressLine(address)}
            addressLabel={address?.label ?? null}
            items={order.order_items ?? []}
            notes={order.notes}
            total={Number(order.total)}
            paymentMethod={order.payment_method}
            paymentStatus={order.payment_status}
          />
        </aside>
      </div>
    </div>
  )
}
