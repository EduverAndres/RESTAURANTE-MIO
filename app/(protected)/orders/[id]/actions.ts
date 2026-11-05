'use server'

import { revalidatePath } from 'next/cache'
import {
  fetchCourierPosition,
  type CourierPosition,
} from '@/lib/courier/server'
import { logger } from '@/lib/log/logger'
import { rebuildCartFromOrder, type ReorderItem } from '@/lib/orders/reorder'
import { createAdminClient } from '@/lib/supabase/admin'
import { createClient } from '@/lib/supabase/server'
import { reviewSchema, type ReviewInput } from '@/lib/validations/checkout'
import { orderIdSchema } from '@/lib/validations/orders'

type Result = { ok: true } | { ok: false; error: string }

const SESSION_EXPIRED = 'Tu sesión expiró. Inicia sesión de nuevo.'

/**
 * Polling fallback for the live map when realtime is quiet or down. Both
 * reads run under the customer's RLS: the order proves ownership and the
 * courier_locations policy only exposes the courier of an active order.
 */
export async function getCourierPosition(
  orderId: string,
): Promise<CourierPosition | null> {
  const parsed = orderIdSchema.safeParse(orderId)
  if (!parsed.success) return null

  const supabase = await createClient()
  const {
    data: { user },
  } = await supabase.auth.getUser()
  if (!user) return null

  const { data: order } = await supabase
    .from('orders')
    .select('courier_id')
    .eq('id', parsed.data)
    .eq('customer_id', user.id)
    .maybeSingle()
  if (!order?.courier_id) return null
  return fetchCourierPosition(supabase, order.courier_id)
}

/**
 * The customer confirms they received a delivery that is on its way, as an
 * alternative to reading the code out to the courier. Ownership is proven by
 * the RLS read (`customer_id = user.id`); the write uses the service role
 * because no customer policy allows this transition, and it is guarded by
 * the same owner and status conditions so nothing else can move.
 */
export async function confirmDelivery(orderId: string): Promise<Result> {
  const parsed = orderIdSchema.safeParse(orderId)
  if (!parsed.success) return { ok: false, error: 'Pedido inválido.' }
  const id = parsed.data

  const supabase = await createClient()
  const {
    data: { user },
  } = await supabase.auth.getUser()
  if (!user) return { ok: false, error: SESSION_EXPIRED }

  const { data: order } = await supabase
    .from('orders')
    .select('id, type, status')
    .eq('id', id)
    .eq('customer_id', user.id)
    .maybeSingle()
  if (!order) return { ok: false, error: 'No encontramos el pedido.' }
  if (order.type !== 'delivery' || order.status !== 'picked_up') {
    return {
      ok: false,
      error: 'Solo puedes confirmar un pedido que ya va en camino.',
    }
  }

  let data: { id: string }[] | null = null
  try {
    const result = await createAdminClient()
      .from('orders')
      .update({
        status: 'delivered',
        delivery_confirmed_by: 'customer',
        delivery_confirmed_at: new Date().toISOString(),
      })
      .eq('id', id)
      .eq('customer_id', user.id)
      .eq('status', 'picked_up')
      .select('id')
    if (result.error) throw result.error
    data = result.data
  } catch (error) {
    logger.error('orders.confirm_delivery.failed', { orderId: id }, error)
    return { ok: false, error: 'No pudimos confirmar la entrega.' }
  }
  if (!data || data.length === 0) {
    return { ok: false, error: 'El pedido cambió de estado. Se actualizará.' }
  }

  revalidatePath(`/orders/${id}`)
  revalidatePath('/courier')
  revalidatePath(`/courier/${id}`)
  revalidatePath('/dashboard')
  return { ok: true }
}

export async function cancelOrder(orderId: string): Promise<Result> {
  const supabase = await createClient()
  const {
    data: { user },
  } = await supabase.auth.getUser()
  if (!user) return { ok: false, error: SESSION_EXPIRED }

  // RLS only allows pending → cancelled by the customer, so a non-pending
  // order simply matches zero rows.
  const { data, error } = await supabase
    .from('orders')
    .update({ status: 'cancelled' })
    .eq('id', orderId)
    .eq('customer_id', user.id)
    .eq('status', 'pending')
    .select('id')
  if (error) {
    console.error('Failed to cancel order', error)
    return { ok: false, error: 'No pudimos cancelar el pedido.' }
  }
  if (!data || data.length === 0) {
    return {
      ok: false,
      error: 'El restaurante ya aceptó el pedido; contáctalo para cancelarlo.',
    }
  }
  revalidatePath(`/orders/${orderId}`)
  revalidatePath('/account')
  return { ok: true }
}

export async function submitReview(input: ReviewInput): Promise<Result> {
  const parsed = reviewSchema.safeParse(input)
  if (!parsed.success) {
    return {
      ok: false,
      error: parsed.error.issues[0]?.message ?? 'Revisa tu valoración.',
    }
  }
  const supabase = await createClient()
  const {
    data: { user },
  } = await supabase.auth.getUser()
  if (!user) return { ok: false, error: SESSION_EXPIRED }

  const { data: order } = await supabase
    .from('orders')
    .select('id, store_id, status')
    .eq('id', parsed.data.orderId)
    .eq('customer_id', user.id)
    .maybeSingle()
  if (!order || order.status !== 'delivered') {
    return { ok: false, error: 'Solo puedes valorar pedidos entregados.' }
  }

  const { error } = await supabase.from('reviews').insert({
    order_id: order.id,
    store_id: order.store_id,
    customer_id: user.id,
    rating: parsed.data.rating,
    comment: parsed.data.comment || null,
  })
  if (error) {
    console.error('Failed to save review', error)
    return {
      ok: false,
      error:
        error.code === '23505'
          ? 'Ya valoraste este pedido.'
          : 'No pudimos guardar tu valoración.',
    }
  }
  revalidatePath(`/orders/${order.id}`)
  return { ok: true }
}

export type ReorderResponse =
  | {
      ok: true
      storeId: string
      storeSlug: string
      items: ReorderItem[]
      skipped: string[]
    }
  | { ok: false; error: string }

const REORDER_CATALOGUE_SELECT =
  'id, name, price, image_url, is_available, store_id, product_options(id, name, required, min, max, product_option_values(id, name, price_delta))'

/**
 * Loads a past order and rebuilds its cart against today's menu. Read-only:
 * the cart lives in the browser, so this only returns the lines and the
 * names that could not be brought back. Ownership is the RLS read
 * (`customer_id = user.id`); the catalogue is public data of an active store.
 */
export async function prepareReorder(
  orderId: string,
): Promise<ReorderResponse> {
  const parsed = orderIdSchema.safeParse(orderId)
  if (!parsed.success) return { ok: false, error: 'Pedido inválido.' }

  const supabase = await createClient()
  const {
    data: { user },
  } = await supabase.auth.getUser()
  if (!user) return { ok: false, error: SESSION_EXPIRED }

  const { data: order } = await supabase
    .from('orders')
    .select(
      'store_id, stores(slug, status), order_items(product_id, name_snapshot, quantity, options)',
    )
    .eq('id', parsed.data)
    .eq('customer_id', user.id)
    .maybeSingle()
  if (!order) return { ok: false, error: 'No encontramos el pedido.' }
  if (!order.stores || order.stores.status !== 'active') {
    return {
      ok: false,
      error: 'Este negocio no está recibiendo pedidos ahora.',
    }
  }

  const lines = order.order_items ?? []
  const productIds = [
    ...new Set(
      lines.flatMap((line) => (line.product_id ? [line.product_id] : [])),
    ),
  ]
  const { data: catalogue, error } = productIds.length
    ? await supabase
        .from('products')
        .select(REORDER_CATALOGUE_SELECT)
        .in('id', productIds)
    : { data: [], error: null }
  if (error) {
    logger.error(
      'orders.reorder.catalogue_failed',
      { orderId: parsed.data },
      error,
    )
    return { ok: false, error: 'No pudimos cargar la carta del negocio.' }
  }

  const { items, skipped } = rebuildCartFromOrder(
    lines,
    catalogue ?? [],
    order.store_id,
  )
  return {
    ok: true,
    storeId: order.store_id,
    storeSlug: order.stores.slug,
    items,
    skipped,
  }
}
