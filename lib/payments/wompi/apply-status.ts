import type { SupabaseClient } from '@supabase/supabase-js'
import { logger } from '@/lib/log/logger'
import { canApplyPaymentStatus } from '@/lib/payments/transitions'
import type { Database } from '@/types/database'
import type { OrderStatus, OrderUpdate, PaymentStatus } from '@/types/app'

export interface GatewayOrder {
  id: string
  status: OrderStatus
  payment_status: PaymentStatus
}

/**
 * Outcome of writing a gateway status onto an order.
 *
 * `write_failed` is deliberately distinct from `skipped`: a skipped
 * transition is a decision (the order is already in a state the gateway may
 * not overwrite) and retrying changes nothing, while a failed write means the
 * customer's money moved and our order did not. Callers must not report
 * success for it — the webhook route answers 5xx so Wompi redelivers.
 */
export type ApplyGatewayResult =
  | {
      outcome: 'applied'
      /**
       * True when a previously auto-cancelled order was put back to `pending`
       * because the gateway approved the payment late. Callers should notify
       * the merchant as if it were a brand-new order.
       */
      reopened: boolean
    }
  | { outcome: 'skipped' }
  | { outcome: 'write_failed' }

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
    logger.error('payments.gateway_status.skipped', {
      orderId: order.id,
      from: order.payment_status,
      to: paymentStatus,
    })
    return { outcome: 'skipped' }
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
    logger.error(
      'payments.gateway_status.write_failed',
      { orderId: order.id },
      error,
    )
    return { outcome: 'write_failed' }
  }
  return { outcome: 'applied', reopened }
}
