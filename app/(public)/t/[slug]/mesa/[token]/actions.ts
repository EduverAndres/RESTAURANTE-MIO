'use server'

import { randomUUID } from 'node:crypto'
import { revalidatePath } from 'next/cache'
import { cookies } from 'next/headers'
import { after } from 'next/server'
import { env } from '@/lib/env'
import { estimateEtaMinutes } from '@/lib/geo'
import {
  buildOrderTotals,
  fetchCatalogue,
  orderItemRows,
  priceCartItems,
  recordPaymentResult,
} from '@/lib/orders/build-order'
import {
  GUEST_ORDERS_COOKIE,
  GUEST_ORDERS_MAX_AGE_SECONDS,
  addGuestOrder,
  parseGuestOrders,
  serializeGuestOrders,
} from '@/lib/orders/guest-orders'
import { getPaymentProvider } from '@/lib/payments'
import { newOrderMessage } from '@/lib/push/messages'
import { sendPushToStoreOwner } from '@/lib/push/send'
import { createAdminClient } from '@/lib/supabase/admin'
import { createClient } from '@/lib/supabase/server'
import { tableOrderPath } from '@/lib/tables/qr'
import { fetchTableByToken } from '@/lib/tables/server'
import {
  guestOrderNotes,
  tableOrderSchema,
  type TableOrderInput,
} from '@/lib/validations/table-order'

export type PlaceTableOrderResult =
  | { ok: true; orderId: string; redirectUrl?: string }
  | { ok: false; error: string; field?: string }

export interface TableRef {
  slug: string
  token: string
}

async function rememberGuestOrder(orderId: string) {
  const cookieStore = await cookies()
  const current = parseGuestOrders(cookieStore.get(GUEST_ORDERS_COOKIE)?.value)
  cookieStore.set(GUEST_ORDERS_COOKIE, serializeGuestOrders(addGuestOrder(current, orderId)), {
    httpOnly: true,
    sameSite: 'lax',
    secure: process.env.NODE_ENV === 'production',
    path: '/',
    maxAge: GUEST_ORDERS_MAX_AGE_SECONDS,
  })
}

/**
 * Creates a dine-in order from a table QR code. Runs as `anon` for guests
 * (the RLS policy allows pending anonymous table orders) and as the customer
 * when logged in. The table is re-resolved from the token, never trusted from
 * the client, and every price is re-derived from the catalogue.
 */
export async function placeTableOrder(
  ref: TableRef,
  input: TableOrderInput,
): Promise<PlaceTableOrderResult> {
  const parsed = tableOrderSchema.safeParse(input)
  if (!parsed.success) {
    const issue = parsed.error.issues[0]
    return {
      ok: false,
      error: issue?.message ?? 'Revisa los datos del pedido.',
      field: String(issue?.path[0] ?? ''),
    }
  }
  const values = parsed.data

  // The service role is needed after the insert (cleanup, short code, payment
  // status), so bail out before writing anything if it is not configured.
  let admin: ReturnType<typeof createAdminClient>
  try {
    admin = createAdminClient()
  } catch (error) {
    console.error('Admin client unavailable for table orders', error)
    return {
      ok: false,
      error: 'No pudimos procesar el pedido en este momento. Inténtalo de nuevo.',
    }
  }

  const resolved = await fetchTableByToken(ref.slug, ref.token)
  if (!resolved)
    return { ok: false, error: 'Este código QR ya no es válido.' }
  const { store, table } = resolved
  if (!store.is_open)
    return { ok: false, error: 'El restaurante está cerrado en este momento.' }

  const supabase = await createClient()
  const {
    data: { user },
  } = await supabase.auth.getUser()

  const catalogue = await fetchCatalogue(
    supabase,
    values.items.map((item) => item.productId),
  )
  const priced = priceCartItems(values.items, catalogue, store.id)
  if (!priced.ok) return priced

  const built = buildOrderTotals({
    items: priced.items,
    type: 'table',
    deliveryFee: Number(store.delivery_fee ?? 0),
    minOrder: Number(store.min_order ?? 0),
    storeName: store.name,
    tipPercent: 0,
  })
  if (!built.ok) return built
  const { totals } = built

  const provider = getPaymentProvider(values.paymentMethod)
  if (!provider)
    return {
      ok: false,
      error: 'Ese método de pago no está disponible.',
      field: 'paymentMethod',
    }

  const etaMinutes = estimateEtaMinutes({
    distanceKm: 0,
    prepTimeMin: store.prep_time_min ?? 20,
    type: 'table',
  })

  // Anonymous inserts cannot be read back (no anon SELECT policy), so the id
  // is generated here and the insert returns nothing.
  const orderId = randomUUID()
  const anonymous = user === null
  const { error: orderError } = await supabase.from('orders').insert({
    id: orderId,
    store_id: store.id,
    customer_id: user?.id ?? null,
    courier_id: null,
    address_id: null,
    type: 'table',
    table_number: table.number,
    status: 'pending',
    subtotal: totals.subtotal,
    delivery_fee: totals.deliveryFee,
    tip: totals.tip,
    payment_method: provider.method,
    payment_status: 'pending',
    notes: guestOrderNotes(values.guestName, values.notes, anonymous),
    estimated_at: new Date(Date.now() + etaMinutes * 60_000).toISOString(),
  })
  if (orderError) {
    console.error('Failed to create table order', orderError)
    return { ok: false, error: 'No pudimos crear el pedido. Inténtalo de nuevo.' }
  }

  const { error: itemsError } = await supabase
    .from('order_items')
    .insert(orderItemRows(orderId, priced.items))
  if (itemsError) {
    console.error('Failed to create table order items', itemsError)
    const { error: cleanupError } = await admin
      .from('orders')
      .delete()
      .eq('id', orderId)
    if (cleanupError) {
      console.error('Failed to remove table order without items', cleanupError)
    }
    return { ok: false, error: 'No pudimos guardar los productos del pedido.' }
  }

  // The short code is generated by the database and is not readable by the
  // anonymous inserter; fall back to a slice of the id if the read fails.
  const { data: created } = await admin
    .from('orders')
    .select('short_code')
    .eq('id', orderId)
    .maybeSingle()
  const shortCode = created?.short_code ?? orderId.slice(0, 8).toUpperCase()

  const payment = await provider.createPayment({
    orderId,
    shortCode,
    amount: totals.total,
    currency: 'COP',
    customer: {
      id: user?.id ?? `guest_${orderId}`,
      email: user?.email ?? null,
      name: values.guestName,
    },
    returnUrl: `${env.NEXT_PUBLIC_SITE_URL}${tableOrderPath(ref.slug, ref.token, orderId)}`,
  })

  const recorded = await recordPaymentResult(admin, orderId, payment)
  if (recorded.failed) {
    return { ok: false, error: recorded.message, field: 'paymentMethod' }
  }

  await rememberGuestOrder(orderId)
  revalidatePath('/dashboard')

  after(() => sendPushToStoreOwner(store.id, newOrderMessage(shortCode, store.name)))

  return { ok: true, orderId, redirectUrl: payment.redirectUrl }
}
