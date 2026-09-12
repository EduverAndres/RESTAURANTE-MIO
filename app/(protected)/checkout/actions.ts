'use server'

import { after } from 'next/server'
import { estimateEtaMinutes, haversineKm, isWithinRadius } from '@/lib/geo'
import {
  buildOrderTotals,
  fetchCatalogue,
  orderItemRows,
  priceCartItems,
  recordPaymentResult,
} from '@/lib/orders/build-order'
import { getPaymentProvider } from '@/lib/payments'
import { newOrderMessage } from '@/lib/push/messages'
import { sendPushToStoreOwner } from '@/lib/push/send'
import { createAdminClient } from '@/lib/supabase/admin'
import { createClient } from '@/lib/supabase/server'
import { env } from '@/lib/env'
import { checkoutSchema, type CheckoutInput } from '@/lib/validations/checkout'
import type { PaymentMethod } from '@/types/app'

export interface CheckoutStore {
  id: string
  slug: string
  name: string
  isOpen: boolean
  minOrder: number
  deliveryFee: number
  deliveryRadiusKm: number
  prepTimeMin: number
  lat: number | null
  lng: number | null
  whatsappPhone: string | null
}

export async function getCheckoutStore(
  storeId: string,
): Promise<CheckoutStore | null> {
  const supabase = await createClient()
  const { data } = await supabase
    .from('stores')
    .select(
      'id, slug, name, is_open, min_order, delivery_fee, delivery_radius_km, prep_time_min, lat, lng, whatsapp_phone',
    )
    .eq('id', storeId)
    .eq('status', 'active')
    .maybeSingle()
  if (!data) return null
  return {
    id: data.id,
    slug: data.slug,
    name: data.name,
    isOpen: Boolean(data.is_open),
    minOrder: Number(data.min_order ?? 0),
    deliveryFee: Number(data.delivery_fee ?? 0),
    deliveryRadiusKm: Number(data.delivery_radius_km ?? 5),
    prepTimeMin: data.prep_time_min ?? 20,
    lat: data.lat,
    lng: data.lng,
    whatsappPhone: data.whatsapp_phone,
  }
}

export type PlaceOrderResult =
  | { ok: true; orderId: string; redirectUrl?: string }
  | { ok: false; error: string; field?: string }

/**
 * Creates an order from the client's cart. Prices, fees and availability are
 * re-derived from the database; the client only sends ids and quantities.
 */
export async function placeOrder(
  input: CheckoutInput,
): Promise<PlaceOrderResult> {
  const parsed = checkoutSchema.safeParse(input)
  if (!parsed.success) {
    const issue = parsed.error.issues[0]
    return {
      ok: false,
      error: issue?.message ?? 'Revisa los datos del pedido.',
      field: String(issue?.path[0] ?? ''),
    }
  }
  const values = parsed.data

  // The service role is needed after the insert (cleanup, payment status),
  // so bail out before writing anything if it is not configured.
  let admin: ReturnType<typeof createAdminClient>
  try {
    admin = createAdminClient()
  } catch (error) {
    console.error('Admin client unavailable for checkout', error)
    return {
      ok: false,
      error: 'No pudimos procesar el pedido en este momento. Inténtalo de nuevo.',
    }
  }

  const supabase = await createClient()
  const {
    data: { user },
  } = await supabase.auth.getUser()
  if (!user)
    return { ok: false, error: 'Tu sesión expiró. Inicia sesión de nuevo.' }

  const store = await getCheckoutStore(values.storeId)
  if (!store)
    return { ok: false, error: 'Este restaurante ya no está disponible.' }
  if (!store.isOpen)
    return { ok: false, error: 'El restaurante está cerrado en este momento.' }

  // Re-price every line from the catalogue.
  const catalogue = await fetchCatalogue(
    supabase,
    values.items.map((item) => item.productId),
  )
  const priced = priceCartItems(values.items, catalogue, store.id)
  if (!priced.ok) return priced
  const pricedItems = priced.items

  // Delivery address and radius.
  let address: {
    id: string
    lat: number | null
    lng: number | null
    line1: string
  } | null = null
  let distanceKm = 0
  if (values.type === 'delivery') {
    const { data } = await supabase
      .from('addresses')
      .select('id, lat, lng, line1')
      .eq('id', values.addressId ?? '')
      .eq('user_id', user.id)
      .maybeSingle()
    if (!data)
      return {
        ok: false,
        error: 'La dirección seleccionada no existe.',
        field: 'addressId',
      }
    address = data
    if (
      store.lat !== null &&
      store.lng !== null &&
      data.lat !== null &&
      data.lng !== null
    ) {
      distanceKm = haversineKm(
        { lat: store.lat, lng: store.lng },
        { lat: data.lat, lng: data.lng },
      )
      if (!isWithinRadius(distanceKm, store.deliveryRadiusKm)) {
        return {
          ok: false,
          error: `Esta dirección está fuera de la zona de entrega (${store.deliveryRadiusKm} km).`,
          field: 'addressId',
        }
      }
    }
  }

  const built = buildOrderTotals({
    items: pricedItems,
    type: values.type,
    deliveryFee: store.deliveryFee,
    minOrder: store.minOrder,
    storeName: store.name,
    tipPercent: values.tipPercent,
  })
  if (!built.ok) return built
  const { totals } = built

  const provider = getPaymentProvider(values.paymentMethod as PaymentMethod)
  if (!provider)
    return {
      ok: false,
      error: 'Ese método de pago no está disponible.',
      field: 'paymentMethod',
    }

  const etaMinutes = estimateEtaMinutes({
    distanceKm,
    prepTimeMin: store.prepTimeMin,
    type: values.type,
  })
  const estimatedAt =
    values.schedule === 'scheduled' && values.scheduledAt
      ? new Date(values.scheduledAt)
      : new Date(Date.now() + etaMinutes * 60_000)

  // Insert under RLS: the customer can only create their own pending order.
  const { data: order, error: orderError } = await supabase
    .from('orders')
    .insert({
      store_id: store.id,
      customer_id: user.id,
      address_id: address?.id ?? null,
      type: values.type,
      status: 'pending',
      subtotal: totals.subtotal,
      delivery_fee: totals.deliveryFee,
      tip: totals.tip,
      payment_method: provider.method,
      payment_status: 'pending',
      notes: values.notes || null,
      estimated_at: estimatedAt.toISOString(),
    })
    .select('id, short_code')
    .single()

  if (orderError || !order) {
    console.error('Failed to create order', orderError)
    return {
      ok: false,
      error: 'No pudimos crear el pedido. Inténtalo de nuevo.',
    }
  }

  const { error: itemsError } = await supabase
    .from('order_items')
    .insert(orderItemRows(order.id, pricedItems))

  if (itemsError) {
    console.error('Failed to create order items', itemsError)
    const { error: cleanupError } = await admin
      .from('orders')
      .delete()
      .eq('id', order.id)
    if (cleanupError) {
      console.error('Failed to remove order without items', cleanupError)
    }
    return { ok: false, error: 'No pudimos guardar los productos del pedido.' }
  }

  // Charge. Payment status is written with the service role because RLS
  // only lets customers cancel their orders.
  const payment = await provider.createPayment({
    orderId: order.id,
    shortCode: order.short_code,
    amount: totals.total,
    currency: 'COP',
    customer: {
      id: user.id,
      email: user.email ?? null,
      name: user.user_metadata?.full_name ?? null,
    },
    returnUrl: `${env.NEXT_PUBLIC_SITE_URL}/orders/${order.id}`,
  })

  const recorded = await recordPaymentResult(admin, order.id, payment)
  if (recorded.failed) {
    return { ok: false, error: recorded.message, field: 'paymentMethod' }
  }

  after(() =>
    sendPushToStoreOwner(store.id, newOrderMessage(order.short_code, store.name)),
  )

  return { ok: true, orderId: order.id, redirectUrl: payment.redirectUrl }
}
