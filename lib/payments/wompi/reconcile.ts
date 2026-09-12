import 'server-only'

import { after } from 'next/server'
import { wompiConfigured } from '@/lib/env.server'
import { applyGatewayStatus } from '@/lib/payments/wompi/apply-status'
import {
  fetchWompiTransaction,
  type WompiTransactionData,
} from '@/lib/payments/wompi/provider'
import { mapWompiStatus } from '@/lib/payments/wompi/status'
import { newOrderMessage } from '@/lib/push/messages'
import { sendPushToStoreOwner } from '@/lib/push/send'
import { createAdminClient } from '@/lib/supabase/admin'
import type { PaymentStatus } from '@/types/app'

export interface ReconcileResult {
  paymentStatus: PaymentStatus
}

export interface ReconcileDependencies {
  /** Gateway lookup; injectable so the flow is testable without a network. */
  fetchTransaction?: (
    transactionId: string,
  ) => Promise<WompiTransactionData | null>
}

/**
 * Re-checks a Wompi transaction from the order return page and applies the
 * result through the same guard the webhook uses, in case the webhook has
 * not arrived yet (or never will, e.g. in local development without a
 * public URL). Silent no-op when Wompi is not configured, the order is not
 * a Wompi order, or the gateway's reference does not match ours.
 */
export async function reconcileWompiTransaction(
  orderId: string,
  transactionId: string,
  { fetchTransaction = fetchWompiTransaction }: ReconcileDependencies = {},
): Promise<ReconcileResult | null> {
  if (!wompiConfigured()) return null

  let admin: ReturnType<typeof createAdminClient>
  try {
    admin = createAdminClient()
  } catch (error) {
    console.error('Admin client unavailable for Wompi reconciliation', error)
    return null
  }

  const { data: order } = await admin
    .from('orders')
    .select(
      'id, status, payment_status, payment_ref, payment_method, store_id, short_code, stores(name)',
    )
    .eq('id', orderId)
    .maybeSingle()
  if (!order || order.payment_method !== 'wompi') return null

  const transaction = await fetchTransaction(transactionId)
  if (!transaction) return null
  if (transaction.reference !== order.payment_ref) {
    console.error('Wompi reconciliation reference mismatch', {
      orderId,
      transactionReference: transaction.reference,
      orderReference: order.payment_ref,
    })
    return null
  }

  const mapped = mapWompiStatus(transaction.status)
  const { reopened } = await applyGatewayStatus(
    admin,
    order,
    mapped.paymentStatus,
  )
  if (reopened) {
    // Runs after the page response is sent: a late approval put the order
    // back to `pending`, so the merchant is told about it as a new order.
    const { store_id: storeId, short_code: shortCode } = order
    const storeName = order.stores?.name ?? 'Tu tienda'
    after(() =>
      sendPushToStoreOwner(storeId, newOrderMessage(shortCode, storeName)),
    )
  }
  return { paymentStatus: mapped.paymentStatus }
}
