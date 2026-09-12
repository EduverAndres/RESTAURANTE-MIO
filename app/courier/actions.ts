'use server'

import { revalidatePath } from 'next/cache'
import { after } from 'next/server'
import { etaFromRoute } from '@/lib/courier/eta'
import { fetchAddressesById, fetchCourierPosition } from '@/lib/courier/server'
import { isUuid } from '@/lib/dashboard/active-store'
import { latLngOf, type LatLng } from '@/lib/geo'
import { canCourierTransition } from '@/lib/orders/status'
import { courierAssignedMessage, orderStatusMessage } from '@/lib/push/messages'
import { sendPushToUsers } from '@/lib/push/send'
import { estimateRoute } from '@/lib/routing'
import { createClient } from '@/lib/supabase/server'
import {
  courierPositionSchema,
  type CourierPositionInput,
} from '@/lib/validations/courier'
import type { OrderStatus } from '@/types/app'

export type CourierActionResult = { ok: true } | { ok: false; error: string }

const SESSION_EXPIRED = 'Tu sesión expiró. Inicia sesión de nuevo.'
const INVALID_ORDER = 'Pedido inválido.'

/** Routes from -> to on the server and returns the ISO arrival time, or null. */
async function estimatedArrival(
  from: LatLng | null,
  to: LatLng | null,
): Promise<string | null> {
  if (!from || !to) return null
  try {
    const route = await estimateRoute(from, to)
    return etaFromRoute({ durationMin: route.durationMin }).toISOString()
  } catch (error) {
    console.error('Failed to estimate delivery route', error)
    return null
  }
}

async function destinationOf(addressId: string | null): Promise<LatLng | null> {
  if (!addressId) return null
  const addresses = await fetchAddressesById([addressId])
  return latLngOf(addresses.get(addressId))
}

function revalidateOrder(orderId: string) {
  revalidatePath('/courier')
  revalidatePath(`/courier/${orderId}`)
  revalidatePath(`/orders/${orderId}`)
}

/**
 * Assigns a pool order to the current courier. The update is guarded by the
 * pool conditions so two couriers cannot both win; zero rows means someone
 * else was faster (or the merchant moved the order).
 */
export async function claimOrder(
  orderId: string,
): Promise<CourierActionResult> {
  if (!isUuid(orderId)) return { ok: false, error: INVALID_ORDER }

  const supabase = await createClient()
  const {
    data: { user },
  } = await supabase.auth.getUser()
  if (!user) return { ok: false, error: SESSION_EXPIRED }

  const { data, error } = await supabase
    .from('orders')
    .update({ courier_id: user.id })
    .eq('id', orderId)
    .is('courier_id', null)
    .eq('status', 'ready')
    .eq('type', 'delivery')
    .select('id, address_id, short_code, customer_id, stores(lat, lng)')
  if (error) {
    console.error('Failed to claim order', error)
    return {
      ok: false,
      error: 'No pudimos tomar el pedido. Inténtalo de nuevo.',
    }
  }
  const claimed = data?.[0]
  if (!claimed) {
    return { ok: false, error: 'Otro domiciliario tomó este pedido.' }
  }

  if (claimed.customer_id) {
    const customerId = claimed.customer_id
    const message = courierAssignedMessage(claimed.short_code, orderId)
    after(() => sendPushToUsers([customerId], message))
  }

  // The ETA is best-effort: the claim already succeeded.
  const estimatedAt = await estimatedArrival(
    latLngOf(claimed.stores),
    await destinationOf(claimed.address_id),
  )
  if (estimatedAt) {
    const { error: etaError } = await supabase
      .from('orders')
      .update({ estimated_at: estimatedAt })
      .eq('id', orderId)
      .eq('courier_id', user.id)
    if (etaError) console.error('Failed to store claim ETA', etaError)
  }

  revalidateOrder(orderId)
  return { ok: true }
}

/**
 * Moves an assigned order along the courier flow (ready -> picked_up ->
 * delivered). On pickup the ETA is recomputed from the courier's last known
 * position (or the store) to the customer.
 */
export async function advanceOrder(
  orderId: string,
  to: OrderStatus,
): Promise<CourierActionResult> {
  if (!isUuid(orderId)) return { ok: false, error: INVALID_ORDER }

  const supabase = await createClient()
  const {
    data: { user },
  } = await supabase.auth.getUser()
  if (!user) return { ok: false, error: SESSION_EXPIRED }

  const { data: order } = await supabase
    .from('orders')
    .select('id, status, address_id, short_code, customer_id, stores(lat, lng)')
    .eq('id', orderId)
    .eq('courier_id', user.id)
    .maybeSingle()
  if (!order) return { ok: false, error: 'No encontramos el pedido.' }

  if (!canCourierTransition(order.status, to)) {
    return {
      ok: false,
      error: 'Ese cambio de estado no está permitido para este pedido.',
    }
  }

  const patch: { status: OrderStatus; estimated_at?: string } = { status: to }
  if (to === 'picked_up') {
    const position = await fetchCourierPosition(supabase, user.id)
    const origin = position
      ? { lat: position.lat, lng: position.lng }
      : latLngOf(order.stores)
    const estimatedAt = await estimatedArrival(
      origin,
      await destinationOf(order.address_id),
    )
    if (estimatedAt) patch.estimated_at = estimatedAt
  }

  const { data, error } = await supabase
    .from('orders')
    .update(patch)
    .eq('id', orderId)
    .eq('courier_id', user.id)
    .eq('status', order.status)
    .select('id')
  if (error) {
    console.error('Failed to advance order', error)
    return { ok: false, error: 'No pudimos actualizar el pedido.' }
  }
  if (!data || data.length === 0) {
    return {
      ok: false,
      error: 'El pedido cambió de estado en otro dispositivo. Se actualizará.',
    }
  }

  revalidateOrder(orderId)

  if (order.customer_id) {
    const message = orderStatusMessage(to, order.short_code, orderId)
    if (message) {
      const customerId = order.customer_id
      after(() => sendPushToUsers([customerId], message))
    }
  }

  return { ok: true }
}

/**
 * Upserts the courier's live position. Called frequently from the browser,
 * so it does not revalidate any path: readers follow it through realtime.
 */
export async function publishLocation(
  input: CourierPositionInput,
): Promise<CourierActionResult> {
  const parsed = courierPositionSchema.safeParse(input)
  if (!parsed.success) return { ok: false, error: 'Ubicación inválida.' }

  const supabase = await createClient()
  const {
    data: { user },
  } = await supabase.auth.getUser()
  if (!user) return { ok: false, error: SESSION_EXPIRED }

  const { error } = await supabase.from('courier_locations').upsert(
    {
      courier_id: user.id,
      lat: parsed.data.lat,
      lng: parsed.data.lng,
      heading: parsed.data.heading,
      updated_at: new Date().toISOString(),
    },
    { onConflict: 'courier_id' },
  )
  if (error) {
    console.error('Failed to publish courier location', error)
    return { ok: false, error: 'No pudimos compartir tu ubicación.' }
  }
  return { ok: true }
}
