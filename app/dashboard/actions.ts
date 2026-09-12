'use server'

import { revalidatePath } from 'next/cache'
import { after } from 'next/server'
import { isUuid } from '@/lib/dashboard/active-store'
import { canMerchantTransition } from '@/lib/orders/status'
import { orderStatusMessage } from '@/lib/push/messages'
import { sendPushToUsers } from '@/lib/push/send'
import { createClient } from '@/lib/supabase/server'
import type { OrderStatus } from '@/types/app'

export type UpdateOrderStatusResult =
  { ok: true } | { ok: false; error: string }

const SESSION_EXPIRED = 'Tu sesión expiró. Inicia sesión de nuevo.'

/**
 * Moves an order along the merchant flow. The transition is re-validated
 * against the current row and the update is guarded by the expected
 * previous status, so two devices cannot apply conflicting moves.
 */
export async function updateOrderStatus(
  orderId: string,
  to: OrderStatus,
): Promise<UpdateOrderStatusResult> {
  if (!isUuid(orderId)) return { ok: false, error: 'Pedido inválido.' }

  const supabase = await createClient()
  const {
    data: { user },
  } = await supabase.auth.getUser()
  if (!user) return { ok: false, error: SESSION_EXPIRED }

  // Customers can also read their own orders, so ownership is checked
  // explicitly through the store instead of trusting the read.
  const { data: order } = await supabase
    .from('orders')
    .select('id, status, type, short_code, customer_id, stores!inner(owner_id)')
    .eq('id', orderId)
    .maybeSingle()
  if (!order || order.stores.owner_id !== user.id) {
    return { ok: false, error: 'No encontramos el pedido.' }
  }

  if (!canMerchantTransition(order.status, to, order.type)) {
    return {
      ok: false,
      error: 'Ese cambio de estado no está permitido para este pedido.',
    }
  }

  const { data, error } = await supabase
    .from('orders')
    .update({ status: to })
    .eq('id', orderId)
    .eq('status', order.status)
    .select('id')
  if (error) {
    console.error('Failed to update order status', error)
    return { ok: false, error: 'No pudimos actualizar el pedido.' }
  }
  if (!data || data.length === 0) {
    return {
      ok: false,
      error: 'El pedido cambió de estado en otro dispositivo. Se actualizará.',
    }
  }

  revalidatePath('/dashboard')
  revalidatePath(`/orders/${orderId}`)

  if (order.customer_id) {
    const message = orderStatusMessage(to, order.short_code, orderId)
    if (message) {
      const customerId = order.customer_id
      after(() => sendPushToUsers([customerId], message))
    }
  }

  return { ok: true }
}
