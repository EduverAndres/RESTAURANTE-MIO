'use server'

import { revalidatePath } from 'next/cache'
import { formatNit } from '@/lib/companies/nit'
import { isUuid } from '@/lib/dashboard/active-store'
import { requireActiveStoreRow } from '@/lib/dashboard/store-context'
import { logger } from '@/lib/log/logger'
import { createAdminClient } from '@/lib/supabase/admin'
import { createClient } from '@/lib/supabase/server'
import {
  merchantInvoiceSchema,
  type MerchantInvoiceInput,
} from '@/lib/validations/companies'

/** What the merchant invoices a corporate order to. */
export interface CorporateBillingView {
  shortCode: string
  total: number
  legalName: string
  nit: string
  billingEmail: string
  billingAddress: string
  reference: string | null
  invoiceRef: string | null
}

export type CorporateBillingResult =
  { ok: true; billing: CorporateBillingView } | { ok: false; error: string }

/**
 * The billing snapshot of one of the store's corporate orders, read with the
 * owner's own session: RLS lets a store owner read only its orders' rows.
 */
export async function getCorporateBilling(
  orderId: string,
): Promise<CorporateBillingResult> {
  if (!isUuid(orderId)) return { ok: false, error: 'Pedido inválido.' }
  const supabase = await createClient()
  const [{ data: billing, error }, { data: order }] = await Promise.all([
    supabase
      .from('order_corporate_billing')
      .select(
        'legal_name, nit, dv, billing_email, billing_address, city, merchant_invoice_ref',
      )
      .eq('order_id', orderId)
      .maybeSingle(),
    supabase
      .from('orders')
      .select('short_code, total, corporate_reference')
      .eq('id', orderId)
      .maybeSingle(),
  ])
  if (error) {
    logger.error('merchant.billing_read_failed', { orderId }, error)
    return { ok: false, error: 'No pudimos leer los datos de facturación.' }
  }
  if (!billing || !order)
    return {
      ok: false,
      error:
        'Este pedido todavía no tiene datos de facturación. Aparecen cuando la empresa autoriza el pago.',
    }
  return {
    ok: true,
    billing: {
      shortCode: order.short_code,
      total: Number(order.total),
      legalName: billing.legal_name,
      nit: formatNit(billing.nit, billing.dv),
      billingEmail: billing.billing_email,
      billingAddress: `${billing.billing_address}, ${billing.city}`,
      reference: order.corporate_reference,
      invoiceRef: billing.merchant_invoice_ref,
    },
  }
}

/** Records the number of the invoice the merchant issued for the order. */
export async function saveMerchantInvoiceRef(
  input: MerchantInvoiceInput,
): Promise<{ ok: true } | { ok: false; error: string }> {
  const parsed = merchantInvoiceSchema.safeParse(input)
  if (!parsed.success)
    return {
      ok: false,
      error: parsed.error.issues[0]?.message ?? 'Revisa el número de factura.',
    }
  const { store } = await requireActiveStoreRow('/dashboard')
  const { data, error } = await createAdminClient()
    .from('order_corporate_billing')
    .update({
      merchant_invoice_ref: parsed.data.invoiceRef,
      invoiced_at: new Date().toISOString(),
    })
    .eq('order_id', parsed.data.orderId)
    .eq('store_id', store.id)
    .select('order_id')
  if (error) {
    logger.error(
      'merchant.invoice_ref_failed',
      { orderId: parsed.data.orderId },
      error,
    )
    return { ok: false, error: 'No pudimos guardar el número de factura.' }
  }
  if (!data || data.length === 0)
    return { ok: false, error: 'No encontramos ese pedido de empresa.' }
  revalidatePath('/dashboard')
  return { ok: true }
}
