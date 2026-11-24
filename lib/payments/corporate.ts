import 'server-only'

import {
  CORPORATE_REJECTION_MESSAGES,
  isCorporateRejection,
} from '@/lib/companies/vocabulary'
import { corporateAccountsEnabled } from '@/lib/env.server'
import { logger } from '@/lib/log/logger'
import type { PaymentProvider, PaymentResult } from '@/lib/payments/types'
import { createAdminClient } from '@/lib/supabase/admin'

const UNAVAILABLE =
  'No pudimos cargar el pedido a la cuenta de empresa. Paga con otro método o inténtalo de nuevo.'

/**
 * "Cuenta de empresa": the employee's company pays, on credit, and the order
 * shows up on the company's monthly statement.
 *
 * There is no gateway. The charge is `authorize_corporate_payment`, which
 * checks the company, the member and every limit under a lock and, when the
 * charge fits, marks the order paid with `corp_<short_code>`. From there the
 * order is settled like any online payment.
 *
 * Not in `listPaymentOptions`: whether it can be offered depends on who is
 * paying (an active member of an active company), so the checkout page adds
 * it itself (lib/companies/server.ts). Behind CORPORATE_ACCOUNTS_ENABLED,
 * off by default.
 */
export const corporateProvider: PaymentProvider = {
  method: 'corporate',
  label: 'Cuenta de empresa',
  description: 'Lo paga tu empresa y llega en su estado de cuenta mensual.',
  isAvailable() {
    return corporateAccountsEnabled()
  },
  async createPayment(input): Promise<PaymentResult> {
    const fallback = `corp_${input.shortCode}`
    const { data, error } = await createAdminClient().rpc(
      'authorize_corporate_payment',
      { p_order_id: input.orderId },
    )
    const row = Array.isArray(data) ? data[0] : data
    if (error || !row) {
      logger.error(
        'corporate.authorize_failed',
        { orderId: input.orderId },
        error,
      )
      return { status: 'failed', reference: fallback, message: UNAVAILABLE }
    }
    if (row.outcome === 'ok') {
      return { status: 'paid', reference: row.payment_ref ?? fallback }
    }
    logger.info('corporate.authorize_refused', {
      orderId: input.orderId,
      outcome: row.outcome,
    })
    return {
      status: 'failed',
      reference: fallback,
      message: isCorporateRejection(row.outcome)
        ? CORPORATE_REJECTION_MESSAGES[row.outcome]
        : UNAVAILABLE,
    }
  },
  async verifyPayment(reference): Promise<PaymentResult> {
    // Nothing to ask a gateway: the order itself is the record.
    const { data } = await createAdminClient()
      .from('orders')
      .select('payment_status')
      .eq('payment_ref', reference)
      .maybeSingle()
    return { status: data?.payment_status ?? 'pending', reference }
  },
}
