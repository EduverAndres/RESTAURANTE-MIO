'use server'

import { revalidatePath } from 'next/cache'
import { after } from 'next/server'
import { etaFromRoute } from '@/lib/courier/eta'
import { fetchAddressesById, fetchCourierPosition } from '@/lib/courier/server'
import { isUuid } from '@/lib/dashboard/active-store'
import { latLngOf, type LatLng } from '@/lib/geo'
import { logger } from '@/lib/log/logger'
import { canCourierTransition } from '@/lib/orders/status'
import {
  courierAssignedMessage,
  deliveryCodeMessage,
  orderStatusMessage,
} from '@/lib/push/messages'
import { sendPushToUsers } from '@/lib/push/send'
import { estimateRoute } from '@/lib/routing'
import { createAdminClient } from '@/lib/supabase/admin'
import { createClient } from '@/lib/supabase/server'
import {
  deliveryCodeMatches,
  generateDeliveryCode,
} from '@/lib/tracking/delivery-code'
import {
  advanceOrderInputSchema,
  courierPositionSchema,
  type AdvanceOrderInput,
  type CourierPositionInput,
} from '@/lib/validations/courier'
import type { OrderStatus } from '@/types/app'

export type CourierActionResult = { ok: true } | { ok: false; error: string }

const SESSION_EXPIRED = 'Tu sesión expiró. Inicia sesión de nuevo.'
const INVALID_ORDER = 'Pedido inválido.'
const CODE_REQUIRED = 'Ingresa el código de entrega que te da el cliente.'
const CODE_MISMATCH = 'El código no coincide. Pídeselo al cliente.'
const CODE_CHECK_FAILED = 'No pudimos verificar el código. Inténtalo de nuevo.'
const UPDATE_FAILED = 'No pudimos actualizar el pedido.'
const STATUS_CHANGED =
  'El pedido cambió de estado en otro dispositivo. Se actualizará.'

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
 * Issues the handover code for a delivery the courier is about to pick up.
 * Written with the service role: couriers have no policy on the table, on
 * purpose. Idempotent through the upsert, so a retried pickup keeps the code
 * the customer may already be looking at.
 */
async function issueDeliveryCode(orderId: string): Promise<boolean> {
  try {
    const { error } = await createAdminClient()
      .from('delivery_codes')
      .upsert(
        { order_id: orderId, code: generateDeliveryCode() },
        { onConflict: 'order_id', ignoreDuplicates: true },
      )
    if (error) throw error
    return true
  } catch (error) {
    logger.error('courier.delivery_code.issue_failed', { orderId }, error)
    return false
  }
}

/**
 * Marks a delivery order delivered once the courier's code matches the one
 * issued to the customer. The code is read and compared here and never
 * returned. The update runs with the service role because the database
 * trigger refuses a courier-role update to `delivered` on a delivery order
 * — that trigger is what makes the code mandatory rather than polite — but
 * it keeps the same guards the RLS path had, so only this courier's own
 * in-flight order can move.
 */
async function deliverWithCode(
  orderId: string,
  courierId: string,
  enteredCode: string,
): Promise<CourierActionResult> {
  let admin: ReturnType<typeof createAdminClient>
  try {
    admin = createAdminClient()
  } catch (error) {
    logger.error('courier.delivery_code.admin_unavailable', { orderId }, error)
    return { ok: false, error: CODE_CHECK_FAILED }
  }

  const { data: issued, error: readError } = await admin
    .from('delivery_codes')
    .select('code')
    .eq('order_id', orderId)
    .maybeSingle()
  if (readError) {
    logger.error('courier.delivery_code.read_failed', { orderId }, readError)
    return { ok: false, error: CODE_CHECK_FAILED }
  }
  if (!deliveryCodeMatches(issued?.code ?? null, enteredCode)) {
    logger.warn('courier.delivery_code.mismatch', { orderId, courierId })
    return { ok: false, error: CODE_MISMATCH }
  }

  const { data, error } = await admin
    .from('orders')
    .update({
      status: 'delivered',
      delivery_confirmed_by: 'code',
      delivery_confirmed_at: new Date().toISOString(),
    })
    .eq('id', orderId)
    .eq('courier_id', courierId)
    .eq('status', 'picked_up')
    .select('id')
  if (error) {
    logger.error('courier.deliver.update_failed', { orderId }, error)
    return { ok: false, error: UPDATE_FAILED }
  }
  if (!data || data.length === 0) return { ok: false, error: STATUS_CHANGED }
  return { ok: true }
}

/**
 * Moves an assigned order along the courier flow (ready -> picked_up ->
 * delivered). On pickup the ETA is recomputed from the courier's last known
 * position (or the store) to the customer and, for a delivery, the handover
 * code is issued. Delivering a delivery order requires that code in `input`.
 */
export async function advanceOrder(
  orderId: string,
  to: OrderStatus,
  input?: AdvanceOrderInput,
): Promise<CourierActionResult> {
  if (!isUuid(orderId)) return { ok: false, error: INVALID_ORDER }
  const parsedInput = advanceOrderInputSchema.safeParse(input)
  if (!parsedInput.success) {
    return {
      ok: false,
      error: parsedInput.error.issues[0]?.message ?? CODE_REQUIRED,
    }
  }

  const supabase = await createClient()
  const {
    data: { user },
  } = await supabase.auth.getUser()
  if (!user) return { ok: false, error: SESSION_EXPIRED }

  const { data: order } = await supabase
    .from('orders')
    .select(
      'id, status, type, address_id, short_code, customer_id, stores(lat, lng)',
    )
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

  const isDelivery = order.type === 'delivery'

  if (to === 'delivered' && isDelivery) {
    const code = parsedInput.data?.code
    if (!code) return { ok: false, error: CODE_REQUIRED }
    const delivered = await deliverWithCode(orderId, user.id, code)
    if (!delivered.ok) return delivered
  } else {
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

      // Without a code the courier could never complete this delivery, so a
      // failed issue aborts the pickup instead of leaving the order stuck.
      if (isDelivery && !(await issueDeliveryCode(orderId))) {
        return { ok: false, error: UPDATE_FAILED }
      }
    }

    const { data, error } = await supabase
      .from('orders')
      .update(patch)
      .eq('id', orderId)
      .eq('courier_id', user.id)
      .eq('status', order.status)
      .select('id')
    if (error) {
      logger.error('courier.advance.update_failed', { orderId, to }, error)
      return { ok: false, error: UPDATE_FAILED }
    }
    if (!data || data.length === 0) return { ok: false, error: STATUS_CHANGED }
  }

  revalidateOrder(orderId)

  if (order.customer_id) {
    const customerId = order.customer_id
    const message = orderStatusMessage(to, order.short_code, orderId)
    if (message) after(() => sendPushToUsers([customerId], message))
    if (to === 'picked_up' && isDelivery) {
      const codeMessage = deliveryCodeMessage(orderId)
      after(() => sendPushToUsers([customerId], codeMessage))
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
      accuracy_m: parsed.data.accuracyM,
      updated_at: new Date().toISOString(),
    },
    { onConflict: 'courier_id' },
  )
  if (error) {
    logger.error('courier.location.publish_failed', undefined, error)
    return { ok: false, error: 'No pudimos compartir tu ubicación.' }
  }
  return { ok: true }
}
