import 'server-only'

import { after } from 'next/server'
import { mercadopagoConfigured } from '@/lib/env.server'
import { logger } from '@/lib/log/logger'
import { mercadopagoProvider } from '@/lib/payments/providers/mercadopago'
import type { PaymentResult } from '@/lib/payments/types'
import { applyGatewayStatus } from '@/lib/payments/wompi/apply-status'
import { newOrderMessage } from '@/lib/push/messages'
import { sendPushToStoreOwner } from '@/lib/push/send'
import { createAdminClient } from '@/lib/supabase/admin'
import type { PaymentStatus } from '@/types/app'

export interface MercadoPagoReconcileResult {
  paymentStatus: PaymentStatus
}

export interface MercadoPagoReconcileDependencies {
  /** Gateway lookup; injectable so the flow is testable without a network. */
  verifyPayment?: (paymentId: string) => Promise<PaymentResult>
}

/** Mercado Pago payment ids are numeric. Anything else is not worth a call. */
const PAYMENT_ID_PATTERN = /^\d{1,20}$/

/**
 * Re-checks a Mercado Pago payment from the order return page
 * (`back_urls` add `?payment_id=…`) and applies it through the same guarded
 * transition Wompi uses. Without it the webhook was the only path: when it
 * did not arrive (wrong notification URL, an http-only server, a dropped
 * delivery) a paid order stayed "pendiente" forever.
 *
 * The payment is read from Mercado Pago's API, never trusted from the query
 * string, and must carry this order's short code as `external_reference`.
 * Silent no-op when Mercado Pago is not configured or the order is not a
 * Mercado Pago order.
 */
export async function reconcileMercadoPagoPayment(
  orderId: string,
  paymentId: string,
  {
    verifyPayment = (id) => mercadopagoProvider.verifyPayment(id),
  }: MercadoPagoReconcileDependencies = {},
): Promise<MercadoPagoReconcileResult | null> {
  if (!mercadopagoConfigured()) return null
  if (!PAYMENT_ID_PATTERN.test(paymentId)) return null

  let admin: ReturnType<typeof createAdminClient>
  try {
    admin = createAdminClient()
  } catch (error) {
    logger.error('mercadopago.reconcile.admin_unavailable', { orderId }, error)
    return null
  }

  const { data: order } = await admin
    .from('orders')
    .select(
      'id, status, payment_status, payment_method, store_id, short_code, stores(name)',
    )
    .eq('id', orderId)
    .maybeSingle()
  if (!order || order.payment_method !== 'mercadopago') return null

  const payment = await verifyPayment(paymentId)
  if (payment.reference !== order.short_code) {
    logger.error('mercadopago.reconcile.reference_mismatch', {
      orderId,
      paymentReference: payment.reference,
    })
    return null
  }
  // `pending` is where the order already is: nothing to write.
  if (payment.status === 'pending') return { paymentStatus: 'pending' }

  const applied = await applyGatewayStatus(admin, order, payment.status)
  if (applied.outcome !== 'applied') return { paymentStatus: payment.status }

  // Same as the webhook: the order keeps Mercado Pago's payment id, which a
  // refund needs. Best-effort, the status is already right.
  const { error: refError } = await admin
    .from('orders')
    .update({ payment_ref: paymentId })
    .eq('id', order.id)
  if (refError) {
    logger.error(
      'mercadopago.reconcile.ref_write_failed',
      { orderId },
      refError,
    )
  }

  if (applied.reopened) {
    // A late approval put an auto-cancelled order back to `pending`: the
    // merchant hears about it as a new order, after the page is sent.
    const { store_id: storeId, short_code: shortCode } = order
    const storeName = order.stores?.name ?? 'Tu tienda'
    after(() =>
      sendPushToStoreOwner(storeId, newOrderMessage(shortCode, storeName)),
    )
  }
  return { paymentStatus: payment.status }
}
