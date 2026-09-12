import type { SupabaseClient } from '@supabase/supabase-js'
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
  | { outcome: 'order_not_found' }
  | { outcome: 'amount_mismatch' }
  | { outcome: 'applied'; paymentStatus: PaymentStatus; reopened: boolean }

const UNIQUE_VIOLATION = '23505'

function transactionOf(event: WompiEvent): WompiTransaction | null {
  const data = event.data as { transaction?: WompiTransaction } | null
  return data?.transaction ?? null
}

/**
 * Processes an already checksum-verified Wompi event: stores it for
 * idempotency and audit, resolves the order from the reference, checks the
 * charged amount against the order total and applies the mapped status
 * through the same transition guard as the return-page reconciliation.
 * Assumes the caller (the route handler) already verified the checksum.
 *
 * `store_failed` means the event could not be persisted (anything but a
 * duplicate): the caller should answer non-200 so Wompi retries later.
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
    provider: 'wompi',
    event_id: transaction.id,
    reference: transaction.reference,
    status: transaction.status,
    amount_in_cents: transaction.amount_in_cents,
    order_id: orderId,
    payload: event as unknown as Json,
  })
  if (insertError) {
    if (insertError.code === UNIQUE_VIOLATION) return { outcome: 'duplicate' }
    console.error('Failed to store Wompi payment event', insertError)
    return { outcome: 'store_failed' }
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
    console.error('Wompi amount mismatch', {
      orderId,
      expectedCents,
      receivedCents: transaction.amount_in_cents,
    })
    return { outcome: 'amount_mismatch' }
  }

  const mapped = mapWompiStatus(transaction.status)
  const { reopened } = await applyGatewayStatus(
    admin,
    order,
    mapped.paymentStatus,
  )
  if (reopened) {
    // The order was auto-cancelled by an earlier failure and is now back to
    // `pending`: the merchant must see it as a fresh order.
    try {
      await sendPushToStoreOwner(
        order.store_id,
        newOrderMessage(order.short_code, order.stores?.name ?? 'Tu tienda'),
      )
    } catch (error) {
      console.error('Failed to notify merchant about a reopened order', error)
    }
  }
  return { outcome: 'applied', paymentStatus: mapped.paymentStatus, reopened }
}
