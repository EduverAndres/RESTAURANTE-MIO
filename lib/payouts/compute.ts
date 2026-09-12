// Pure payout aggregation. No React, no Supabase.
//
// A store is settled on the subtotal and the platform commission only:
// the delivery fee (paid to the courier/platform for logistics) and the
// tip (paid to the courier) never belong to the merchant, so they are
// excluded from gross/net on purpose.
import type { OrderStatus, PaymentMethod, PaymentStatus } from '@/types/app'

export interface PayoutOrderInput {
  store_id: string
  status: OrderStatus
  subtotal: number
  platform_fee: number
  delivered_at: string | null
  payment_method: PaymentMethod
  payment_status: PaymentStatus
}

export interface PayoutPeriod {
  /** Inclusive, date-only (`YYYY-MM-DD`). */
  periodStart: string
  /** Inclusive, date-only (`YYYY-MM-DD`). */
  periodEnd: string
}

export interface PayoutSummaryRow {
  store_id: string
  period_start: string
  period_end: string
  gross: number
  commission: number
  net: number
}

function isEligible(order: PayoutOrderInput): boolean {
  if (order.status !== 'delivered') return false
  return order.payment_status === 'paid' || order.payment_method === 'cash'
}

/** Start of `dateOnly`, inclusive. */
function periodStartMs(dateOnly: string): number {
  return new Date(`${dateOnly}T00:00:00.000Z`).getTime()
}

/**
 * Start (UTC) of the day after `dateOnly`, i.e. the exclusive upper bound of
 * an inclusive date-only period. Shared with the payout generation query.
 */
export function periodEndExclusive(dateOnly: string): Date {
  const next = new Date(`${dateOnly}T00:00:00.000Z`)
  next.setUTCDate(next.getUTCDate() + 1)
  return next
}

function inPeriod(
  deliveredAt: string | null,
  fromMs: number,
  toExclusiveMs: number,
): boolean {
  if (!deliveredAt) return false
  const time = new Date(deliveredAt).getTime()
  return time >= fromMs && time < toExclusiveMs
}

/**
 * Per-store settlement totals for delivered, eligible orders inside the
 * period. Eligible = delivered AND (paid electronically OR paid in cash);
 * cash orders never carry an online `payment_status`, so they are settled
 * on delivery instead of on payment confirmation.
 */
export function summarizePayouts(
  orders: readonly PayoutOrderInput[],
  { periodStart, periodEnd }: PayoutPeriod,
): PayoutSummaryRow[] {
  const fromMs = periodStartMs(periodStart)
  const toExclusiveMs = periodEndExclusive(periodEnd).getTime()

  const totals = new Map<string, { gross: number; commission: number }>()
  for (const order of orders) {
    if (!isEligible(order)) continue
    if (!inPeriod(order.delivered_at, fromMs, toExclusiveMs)) continue

    const entry = totals.get(order.store_id) ?? { gross: 0, commission: 0 }
    entry.gross += order.subtotal
    entry.commission += order.platform_fee
    totals.set(order.store_id, entry)
  }

  return [...totals.entries()]
    .map(([store_id, { gross, commission }]) => ({
      store_id,
      period_start: periodStart,
      period_end: periodEnd,
      gross,
      commission,
      net: gross - commission,
    }))
    .sort((a, b) => a.store_id.localeCompare(b.store_id))
}
