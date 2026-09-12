// Order-building logic shared by the logged-in checkout (placeOrder) and the
// anonymous table checkout (placeTableOrder). The client only sends product
// ids, option value ids and quantities; everything with a price is derived
// here from catalogue rows loaded by the caller. Pure except fetchCatalogue,
// which takes the Supabase client as a parameter so tests never need one.
import type { SupabaseClient } from '@supabase/supabase-js'
import { canApplyPaymentStatus } from '@/lib/payments/transitions'
import type { PaymentResult } from '@/lib/payments/types'
import { computeOrderTotals, computeTip, meetsMinOrder } from '@/lib/pricing'
import type { OrderTotals } from '@/lib/pricing'
import type { CartItemPayload } from '@/lib/validations/checkout'
import type {
  OrderItemInsert,
  OrderItemOption,
  OrderType,
  OrderUpdate,
} from '@/types/app'
import type { Database, Json } from '@/types/database'

export const CATALOGUE_SELECT =
  'id, name, price, is_available, store_id, product_options(id, name, required, min, max, product_option_values(id, name, price_delta))'

export interface CatalogueOptionValue {
  id: string
  name: string
  price_delta: number | string
}

export interface CatalogueOption {
  id: string
  name: string
  required: boolean
  min: number
  max: number
  product_option_values: CatalogueOptionValue[]
}

export interface CatalogueProduct {
  id: string
  name: string
  price: number | string
  is_available: boolean
  store_id: string
  product_options: CatalogueOption[]
}

export interface PricedItem {
  product_id: string
  name_snapshot: string
  unit_price: number
  quantity: number
  options: OrderItemOption[]
  notes: string
}

export type BuildResult<T> = ({ ok: true } & T) | { ok: false; error: string }

export const PRODUCT_UNAVAILABLE_ERROR =
  'Uno de los productos ya no está disponible. Revisa tu carrito.'

/** Loads the catalogue rows for the given products under the caller's RLS. */
export async function fetchCatalogue(
  supabase: SupabaseClient<Database>,
  productIds: readonly string[],
): Promise<CatalogueProduct[]> {
  const unique = [...new Set(productIds)]
  if (unique.length === 0) return []
  const { data } = await supabase
    .from('products')
    .select(CATALOGUE_SELECT)
    .in('id', unique)
  return data ?? []
}

/**
 * Re-prices every cart line from the catalogue and validates the chosen
 * options against each group's min/max. Fails on the first problem with a
 * customer-facing Spanish message.
 */
export function priceCartItems(
  items: readonly CartItemPayload[],
  catalogue: readonly CatalogueProduct[],
  storeId: string,
): BuildResult<{ items: PricedItem[] }> {
  const byId = new Map(catalogue.map((product) => [product.id, product]))
  const priced: PricedItem[] = []

  for (const item of items) {
    const product = byId.get(item.productId)
    if (!product || product.store_id !== storeId || !product.is_available) {
      return { ok: false, error: PRODUCT_UNAVAILABLE_ERROR }
    }
    const options: OrderItemOption[] = []
    for (const option of product.product_options) {
      const chosen = option.product_option_values.filter((value) =>
        item.optionValueIds.includes(value.id),
      )
      const min = option.required ? Math.max(1, option.min) : option.min
      if (chosen.length < min || chosen.length > Math.max(1, option.max)) {
        return { ok: false, error: `Revisa las opciones de ${product.name}.` }
      }
      chosen.forEach((value) =>
        options.push({
          option: option.name,
          value: value.name,
          price_delta: Number(value.price_delta),
        }),
      )
    }
    priced.push({
      product_id: product.id,
      name_snapshot: product.name,
      unit_price: Number(product.price),
      quantity: item.quantity,
      options,
      notes: item.notes,
    })
  }
  return { ok: true, items: priced }
}

export interface OrderTotalsRequest {
  items: readonly PricedItem[]
  type: OrderType
  deliveryFee: number
  minOrder: number
  storeName: string
  tipPercent: number
}

/** Subtotal, fee, tip and total; fails when the store minimum is not met. */
export function buildOrderTotals(
  request: OrderTotalsRequest,
): BuildResult<{ totals: OrderTotals }> {
  const items = request.items.map((item) => ({
    unitPrice: item.unit_price,
    quantity: item.quantity,
    options: item.options,
  }))
  const preliminary = computeOrderTotals({
    items,
    type: request.type,
    deliveryFee: request.deliveryFee,
    tip: 0,
  })
  if (!meetsMinOrder(preliminary.subtotal, request.minOrder)) {
    return {
      ok: false,
      error: `El pedido mínimo de ${request.storeName} no se alcanza.`,
    }
  }
  const tip = computeTip(preliminary.subtotal, {
    kind: 'percent',
    value: request.tipPercent,
  })
  const totals = computeOrderTotals({
    items,
    type: request.type,
    deliveryFee: request.deliveryFee,
    tip,
  })
  return { ok: true, totals }
}

/** Rows for order_items; line notes are folded into the name snapshot. */
export function orderItemRows(
  orderId: string,
  items: readonly PricedItem[],
): OrderItemInsert[] {
  return items.map((item) => ({
    order_id: orderId,
    product_id: item.product_id,
    name_snapshot: item.notes
      ? `${item.name_snapshot} · ${item.notes}`
      : item.name_snapshot,
    unit_price: item.unit_price,
    quantity: item.quantity,
    options: item.options as unknown as Json,
  }))
}

export const PAYMENT_REJECTED_ERROR = 'El pago fue rechazado.'

/** Outcome of recording a payment; `message` is customer-facing Spanish. */
export type PaymentRecord =
  | { failed: true; message: string }
  | { failed: false }

/**
 * Writes the gateway outcome on the order with the service role (RLS only
 * lets customers cancel). A failed payment cancels the order; any other
 * status is stored as-is. The transition is checked against the order's
 * current payment status first: a forbidden move (e.g. a late webhook
 * declaring `failed` after the order is already `paid`) is logged and
 * skipped, never applied. Database errors are logged, never thrown, so the
 * caller can still answer the customer.
 */
export async function recordPaymentResult(
  admin: SupabaseClient<Database>,
  orderId: string,
  payment: PaymentResult,
): Promise<PaymentRecord> {
  const { data: current } = await admin
    .from('orders')
    .select('payment_status')
    .eq('id', orderId)
    .maybeSingle()
  const from = current?.payment_status ?? 'pending'
  if (!canApplyPaymentStatus(from, payment.status)) {
    console.error('Skipped forbidden payment transition', {
      orderId,
      from,
      to: payment.status,
    })
    return { failed: false }
  }

  const failed = payment.status === 'failed'
  const patch: OrderUpdate = failed
    ? { status: 'cancelled', payment_status: 'failed', payment_ref: payment.reference }
    : { payment_status: payment.status, payment_ref: payment.reference }
  const { error } = await admin.from('orders').update(patch).eq('id', orderId)
  if (error) {
    console.error(
      failed ? 'Failed to cancel order after payment failure' : 'Failed to record payment',
      error,
    )
  }
  return failed
    ? { failed: true, message: payment.message ?? PAYMENT_REJECTED_ERROR }
    : { failed: false }
}
