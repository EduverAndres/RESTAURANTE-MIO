import 'server-only'

import { logger } from '@/lib/log/logger'
import { refundThroughGateway } from '@/lib/refunds/gateway'
import {
  REFUND_REJECTION_MESSAGES,
  planRefund,
  type RefundInput,
  type RefundOrder,
  type RefundRejection,
} from '@/lib/refunds/plan'
import { createAdminClient } from '@/lib/supabase/admin'

export type RecordRefundResult = { ok: true } | { ok: false; error: string }

const GENERIC_ERROR = 'No pudimos registrar el reembolso. Inténtalo de nuevo.'

export interface RecordRefundParams {
  order: RefundOrder
  input: RefundInput
  /** Profile id of whoever pressed the button. */
  issuedBy: string
  /** Only for the log: which surface the refund came from. */
  actor: 'merchant' | 'admin'
}

/** Every answer `public.record_refund` can give. */
const OUTCOMES = [
  'ok',
  'order_not_found',
  'status_changed',
  'already_refunded',
] as const
type RecordRefundOutcome = (typeof OUTCOMES)[number]

function isOutcome(value: unknown): value is RecordRefundOutcome {
  return (OUTCOMES as readonly unknown[]).includes(value)
}

/**
 * Writes the bookkeeping record that money went back to a customer and moves
 * the order to `refunded`.
 *
 * ---------------------------------------------------------------------------
 * Why this is one database call
 * ---------------------------------------------------------------------------
 * It used to be two: insert the refund row, then update the order, with a
 * compensating DELETE if the update failed. That has a hole no amount of
 * application care closes — when the compensating delete ALSO fails, a refund
 * row stays committed on an order that still reads as paid. Payout generation
 * then settles that sale in full, and the refund produces no clawback because
 * it predates every payout, so the merchant is paid for money they gave back
 * and nothing anywhere says so.
 *
 * PostgREST gives each call its own transaction, so the two writes cannot be
 * made atomic from here. They are done inside `public.record_refund`
 * (`supabase/migrations/20260919000500_money_transactions.sql`) instead:
 * either both land or neither does, and no rollback has to be trusted.
 *
 * The DECISION still lives here. `planRefund` is the single source of truth
 * for whether an order may be refunded and what row to write; the function is
 * the transaction, not a second rule set. The one thing it re-checks is that
 * the order still holds the `payment_status` this plan was decided against —
 * which is what closes the gap between the caller's read and this write.
 *
 * Both paths use the service role. The caller has already re-authenticated
 * and proved ownership; `refunds` deliberately has no INSERT policy for
 * browser sessions, and `record_refund` is granted to `service_role` only.
 */
export async function recordRefund({
  order,
  input,
  issuedBy,
  actor,
}: RecordRefundParams): Promise<RecordRefundResult> {
  const plan = planRefund(order, input)
  if (!plan.ok) {
    return { ok: false, error: REFUND_REJECTION_MESSAGES[plan.error] }
  }

  const admin = createAdminClient()
  const { data, error } = await admin.rpc('record_refund', {
    p_order_id: plan.refund.order_id,
    // The status `planRefund` judged, so a decision made on a stale read
    // cannot be applied to a row that has since moved.
    p_expected_payment_status: order.payment_status,
    p_amount: plan.refund.amount,
    p_reason: plan.refund.reason,
    p_method: plan.refund.method,
    p_note: plan.refund.note,
    p_issued_by: issuedBy,
  })
  if (error || !isOutcome(data)) {
    logger.error(
      'refunds.record_failed',
      { orderId: order.id, storeId: order.store_id, actor, outcome: data },
      error,
    )
    return { ok: false, error: GENERIC_ERROR }
  }
  if (data !== 'ok') {
    // `order_not_found` is the one outcome with no refund vocabulary: the
    // order was deleted between the caller's read and this write.
    const rejection: RefundRejection =
      data === 'order_not_found' ? 'not_refundable' : data
    logger.info('refunds.rejected', {
      orderId: order.id,
      storeId: order.store_id,
      actor,
      outcome: data,
    })
    return { ok: false, error: REFUND_REJECTION_MESSAGES[rejection] }
  }

  // The seam. It does nothing today; calling it here rather than leaving a
  // comment keeps the ordering contract (bookkeeping first, gateway second)
  // visible in the code the day it stops being a no-op.
  const gateway = await refundThroughGateway({
    provider: order.payment_method,
    amountInCents: Math.round(plan.refund.amount * 100),
  })

  logger.info('refunds.recorded', {
    orderId: order.id,
    storeId: order.store_id,
    amount: plan.refund.amount,
    reason: plan.refund.reason,
    method: plan.refund.method,
    actor,
    gatewayAttempted: gateway.attempted,
  })

  return { ok: true }
}
