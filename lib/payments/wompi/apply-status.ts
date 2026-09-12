import type { SupabaseClient } from '@supabase/supabase-js'
import { canApplyPaymentStatus } from '@/lib/payments/transitions'
import type { Database } from '@/types/database'
import type { OrderStatus, OrderUpdate, PaymentStatus } from '@/types/app'

export interface GatewayOrder {
  id: string
  status: OrderStatus
  payment_status: PaymentStatus
}

export interface ApplyGatewayResult {
  /**
   * True when a previously auto-cancelled order was put back to `pending`
   * because the gateway approved the payment late. Callers should notify
   * the merchant as if it were a brand-new order.
   */
  reopened: boolean
}

/**
 * Applies a gateway-reported payment status to an order, shared by the
 * Wompi webhook and the return-page reconciliation. The transition is
 * checked first (a stale or forbidden move is logged and skipped, never
 * applied); a `failed` result only cancels the order while it is still
 * `pending` (a merchant may have already accepted it by other means), and
 * a late `paid` on an order that was auto-cancelled reopens it as `pending`.
 */
export async function applyGatewayStatus(
  admin: SupabaseClient<Database>,
  order: GatewayOrder,
  paymentStatus: PaymentStatus,
): Promise<ApplyGatewayResult> {
  if (!canApplyPaymentStatus(order.payment_status, paymentStatus)) {
    console.error('Skipped forbidden gateway payment transition', {
      orderId: order.id,
      from: order.payment_status,
      to: paymentStatus,
    })
    return { reopened: false }
  }

  const patch: OrderUpdate = { payment_status: paymentStatus }
  let reopened = false
  if (paymentStatus === 'failed' && order.status === 'pending') {
    patch.status = 'cancelled'
  } else if (paymentStatus === 'paid' && order.status === 'cancelled') {
    patch.status = 'pending'
    reopened = true
  }

  const { error } = await admin.from('orders').update(patch).eq('id', order.id)
  if (error) {
    console.error('Failed to apply gateway payment status', error)
    return { reopened: false }
  }
  return { reopened }
}
