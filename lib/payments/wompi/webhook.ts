import type { SupabaseClient } from '@supabase/supabase-js'
import { logger } from '@/lib/log/logger'
import { applyGatewayStatus } from '@/lib/payments/wompi/apply-status'
import type { WompiEvent } from '@/lib/payments/wompi/signature'
import { mapWompiStatus, orderIdFromReference } from '@/lib/payments/wompi/status'
import { newOrderMessage } from '@/lib/push/messages'
import { sendPushToStoreOwner } from '@/lib/push/send'
import type { Database, Json } from '@/types/database'
import type { PaymentStatus } from '@/types/app'

interface WompiTransaction {
  id: string
  status: string
  reference: string
  amount_in_cents: number
  payment_method_type?: string
  customer_email?: string | null
  status_message?: string | null
}

export type WompiEventOutcome =
  | { outcome: 'ignored' }
  | { outcome: 'duplicate' }
  | { outcome: 'store_failed' }
  | { outcome: 'apply_failed' }
  | { outcome: 'order_not_found' }
  | { outcome: 'amount_mismatch' }
  | { outcome: 'applied'; paymentStatus: PaymentStatus; reopened: boolean }

const UNIQUE_VIOLATION = '23505'
const PROVIDER = 'wompi'

function transactionOf(event: WompiEvent): WompiTransaction | null {
  const data = event.data as { transaction?: WompiTransaction } | null
  return data?.transaction ?? null
}

/**
 * Whether a replayed delivery of this transaction still has work to do.
 *
 * The insert hit the unique constraint, so the row exists. It is only a real
 * duplicate if the first delivery also managed to move the order; a row with
 * `applied_at IS NULL` was stored and then lost (a failed orders-UPDATE, a
 * crash between the two writes), which is precisely what Wompi's retry is
 * for. When the row cannot be read back we fall back to `duplicate`: a
 * needless re-apply of an unknown state is worse than a missed heal, and the
 * partial index keeps the row visible for a human.
 */
async function storedEventNeedsApply(
  admin: SupabaseClient<Database>,
  transaction: WompiTransaction,
): Promise<boolean> {
  const { data, error } = await admin
    .from('payment_events')
    .select('applied_at')
    .eq('provider', PROVIDER)
    .eq('event_id', transaction.id)
    .eq('status', transaction.status)
    .maybeSingle()
  if (error) {
    logger.error(
      'wompi.webhook.event_readback_failed',
      { eventId: transaction.id, status: transaction.status },
      error,
    )
    return false
  }
  return Boolean(data) && data?.applied_at === null
}

/**
 * Stamps `applied_at` once the order really moved. A failure here is logged
 * but not propagated: the order is already correct, and the worst case is
 * that a later replay re-applies a status the transition guard treats as a
 * no-op.
 */
async function markEventApplied(
  admin: SupabaseClient<Database>,
  transaction: WompiTransaction,
): Promise<void> {
  const { error } = await admin
    .from('payment_events')
    .update({ applied_at: new Date().toISOString() })
    .eq('provider', PROVIDER)
    .eq('event_id', transaction.id)
    .eq('status', transaction.status)
  if (error) {
    logger.error(
      'wompi.webhook.mark_applied_failed',
      { eventId: transaction.id, status: transaction.status },
      error,
    )
  }
}

/**
 * Processes an already checksum-verified Wompi event: stores it for
 * idempotency and audit, resolves the order from the reference, checks the
 * charged amount against the order total and applies the mapped status
 * through the same transition guard as the return-page reconciliation.
 * Assumes the caller (the route handler) already verified the checksum.
 *
 * `store_failed` means the event could not be persisted (anything but a
 * duplicate) and `apply_failed` means it was persisted but the order could
 * not be updated: the caller should answer non-200 for both so Wompi retries
 * later. `applied_at` is stamped only after a successful apply, so that retry
 * re-applies instead of short-circuiting as a duplicate.
 */
export async function handleWompiEvent(
  admin: SupabaseClient<Database>,
  event: WompiEvent,
): Promise<WompiEventOutcome> {
  if (event.event !== 'transaction.updated') return { outcome: 'ignored' }

  const transaction = transactionOf(event)
  if (!transaction) return { outcome: 'ignored' }

  const orderId = orderIdFromReference(transaction.reference)
  const { error: insertError } = await admin.from('payment_events').insert({
    provider: PROVIDER,
    event_id: transaction.id,
    reference: transaction.reference,
    status: transaction.status,
    amount_in_cents: transaction.amount_in_cents,
    order_id: orderId,
    payload: event as unknown as Json,
  })
  if (insertError) {
    if (insertError.code !== UNIQUE_VIOLATION) {
      logger.error(
        'wompi.webhook.store_failed',
        { eventId: transaction.id, orderId },
        insertError,
      )
      return { outcome: 'store_failed' }
    }
    if (!(await storedEventNeedsApply(admin, transaction))) {
      return { outcome: 'duplicate' }
    }
    // Stored but never applied: fall through and heal the order.
  }

  if (!orderId) return { outcome: 'order_not_found' }

  const { data: order } = await admin
    .from('orders')
    .select(
      'id, status, payment_status, payment_ref, total, store_id, short_code, stores(name)',
    )
    .eq('id', orderId)
    .eq('payment_ref', transaction.reference)
    .maybeSingle()
  if (!order) return { outcome: 'order_not_found' }

  const expectedCents = Math.round(Number(order.total) * 100)
  if (transaction.amount_in_cents !== expectedCents) {
    logger.error('wompi.webhook.amount_mismatch', {
      orderId,
      expectedCents,
      receivedCents: transaction.amount_in_cents,
    })
    return { outcome: 'amount_mismatch' }
  }

  const mapped = mapWompiStatus(transaction.status)
  const applied = await applyGatewayStatus(admin, order, mapped.paymentStatus)
  if (applied.outcome === 'write_failed') return { outcome: 'apply_failed' }

  await markEventApplied(admin, transaction)

  const reopened = applied.outcome === 'applied' && applied.reopened
  if (reopened) {
    // The order was auto-cancelled by an earlier failure and is now back to
    // `pending`: the merchant must see it as a fresh order.
    try {
      await sendPushToStoreOwner(
        order.store_id,
        newOrderMessage(order.short_code, order.stores?.name ?? 'Tu tienda'),
      )
    } catch (error) {
      logger.error('wompi.webhook.reopen_notify_failed', { orderId }, error)
    }
  }
  return { outcome: 'applied', paymentStatus: mapped.paymentStatus, reopened }
}
