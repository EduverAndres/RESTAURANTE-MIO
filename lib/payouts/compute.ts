// Pure payout aggregation. No React, no Supabase.
//
// A store is settled on its sale (subtotal minus its own discount) and the
// platform commission. The delivery fee and the tip belong to whoever did
// the delivery or served the order: a platform courier is paid through the
// courier ledger, but when the merchant handed an order over themselves and
// the customer paid online, the platform is holding the merchant's delivery
// fee and tip, so they are passed through here (`delivery_and_tips`).
//
// What the platform transfers is not the whole sale. Cash the merchant took
// in person is already in their till, the plan's monthly fee and the days of
// sponsored placement (lib/ads/billing.ts) are charged here too, and an
// unpaid debt from an earlier period is carried in, so
//
//   net = gross - commission - cash_collected - plan_fee - ads_fee
//         + delivery_and_tips + carried_in
//
// A negative net is a debt to the platform (see `isDebtToPlatform`): a
// merchant who sells mostly in cash owes the commission on those sales. It is
// carried into the store's next payout (`lib/payouts/carry.ts`) until it is
// settled, instead of being forgotten.
import type { AdsFeeInput } from '@/lib/ads/billing'
import type {
  OrderStatus,
  OrderType,
  PaymentMethod,
  PaymentStatus,
} from '@/types/app'

export interface PayoutOrderInput {
  store_id: string
  status: OrderStatus
  type: OrderType
  /** Null when no platform courier took the order (pickup, table, own delivery). */
  courier_id: string | null
  subtotal: number
  /** Store coupon or loyalty reward: lowers the store's sale. */
  merchant_discount: number
  /** Referral credit: paid by the platform, not by the store. */
  platform_discount: number
  platform_fee: number
  /** What the customer paid for the delivery itself. */
  delivery_fee: number
  tip: number
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
  /** Subtotals the merchant already collected in cash. */
  cash_collected: number
  /** The plan's monthly fee, prorated to the period. */
  plan_fee: number
  /** Days of sponsored placement that ran in the period (lib/ads/billing.ts). */
  ads_fee: number
  /**
   * Delivery fees and tips the platform collected online for orders the
   * merchant handed over themselves (see `isPassedThroughToMerchant`).
   */
  delivery_and_tips: number
  /** Unpaid debt from earlier periods, carried in. Never positive. */
  carried_in: number
  net: number
}

/**
 * A refunded order drops out here — `payment_status` is `refunded`, so it is
 * neither `paid` nor eligible as cash. That covers everything refunded before
 * its period was generated. What was refunded *after* generation is already
 * inside a settled payout row this function can no longer see; that is what
 * `lib/payouts/reversal.ts` carries in as a negative adjustment.
 *
 * MIRRORED IN SQL. Payout generation runs as one transaction inside
 * `public.generate_payouts`, so this predicate also exists as SQL in
 * `lib/payouts/sql.ts` and is embedded in
 * `supabase/migrations/20260919000500_money_transactions.sql`. Changing it
 * here fails `tests/payouts-sql-drift.test.ts` until the mirror follows.
 */
export function isEligible(order: PayoutOrderInput): boolean {
  if (order.status !== 'delivered') return false
  if (order.payment_status === 'refunded') return false
  return order.payment_status === 'paid' || order.payment_method === 'cash'
}

/**
 * Whether the merchant, not the platform, ended up holding the money.
 *
 * A cash sale is collected by whoever hands the order over: the merchant at
 * the counter or the table, or on a delivery they made themselves. Only a
 * cash delivery taken by a platform courier puts the money in the platform's
 * hands, and that one is still owed to the merchant.
 *
 * MIRRORED IN SQL (`MERCHANT_COLLECTED_RULE` in lib/payouts/sql.ts).
 */
export function isCollectedByMerchant(
  order: Pick<PayoutOrderInput, 'payment_method' | 'type' | 'courier_id'>,
): boolean {
  if (order.payment_method !== 'cash') return false
  return order.type !== 'delivery' || order.courier_id === null
}

/**
 * Whether the delivery fee and the tip of a settled order belong to the
 * merchant AND are held by the platform.
 *
 * The platform holds them when the customer paid online. They belong to the
 * merchant when no platform courier was involved: a pickup or table order
 * (the tip goes to the team that served it) or a delivery the merchant made
 * with their own staff. A platform courier's fee and tip go to the courier
 * ledger instead; a cash order's are already in the merchant's till.
 *
 * MIRRORED IN SQL (`MERCHANT_PASSTHROUGH_RULE` in lib/payouts/sql.ts).
 */
export function isPassedThroughToMerchant(
  order: Pick<PayoutOrderInput, 'payment_method' | 'type' | 'courier_id'>,
): boolean {
  if (order.payment_method === 'cash') return false
  return order.type !== 'delivery' || order.courier_id === null
}

/** The delivery fee plus the tip. MIRRORED IN SQL (`PASSTHROUGH_AMOUNT_SQL`). */
export function passthroughAmount(
  order: Pick<PayoutOrderInput, 'delivery_fee' | 'tip'>,
): number {
  return order.delivery_fee + order.tip
}

/**
 * What the platform transfers (or, when negative, is owed).
 * MIRRORED IN SQL (`PAYOUT_NET_SQL` in lib/payouts/sql.ts).
 */
export function payoutNet(parts: {
  gross: number
  commission: number
  cash_collected: number
  plan_fee: number
  ads_fee: number
  delivery_and_tips: number
  carried_in: number
}): number {
  return (
    parts.gross -
    parts.commission -
    parts.cash_collected -
    parts.plan_fee -
    parts.ads_fee +
    parts.delivery_and_tips +
    parts.carried_in
  )
}

/**
 * The store's sale on one order: what it charged minus its own discount.
 * MIRRORED IN SQL (`SETTLED_GROSS_SQL`).
 */
export function settledGross(
  order: Pick<PayoutOrderInput, 'subtotal' | 'merchant_discount'>,
): number {
  return order.subtotal - order.merchant_discount
}

/**
 * What the customer actually handed over toward the subtotal: the sale minus
 * the platform's credit too. When the merchant collected it in cash, this is
 * what is already in their till. MIRRORED IN SQL (`COLLECTED_AMOUNT_SQL`).
 */
export function collectedAmount(
  order: Pick<
    PayoutOrderInput,
    'subtotal' | 'merchant_discount' | 'platform_discount'
  >,
): number {
  return order.subtotal - order.merchant_discount - order.platform_discount
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

/** A negative entry carried in from `lib/payouts/reversal.ts`. */
export interface PayoutAdjustmentInput {
  store_id: string
  gross: number
  commission: number
  cash_collected: number
  delivery_and_tips: number
}

/** One store's unpaid debt carried in, from `planCarries`. */
export interface CarryInput {
  store_id: string
  /** Never positive. */
  carried_in: number
}

/** One store's plan fee for the period, from `planFeeForPeriod`. */
export interface PlanFeeInput {
  store_id: string
  plan_fee: number
}

/**
 * Per-store settlement totals for delivered, eligible orders inside the
 * period. Eligible = delivered AND (paid electronically OR paid in cash);
 * cash orders never carry an online `payment_status`, so they are settled
 * on delivery instead of on payment confirmation.
 *
 * `adjustments` are reversals of sales settled in an earlier period (see
 * `lib/payouts/reversal.ts`). They are folded in as ordinary — negative —
 * contributions, so a store whose only activity this period is a reversal
 * still gets a row, and a period whose reversals exceed its sales comes out
 * negative rather than clamped: see `isDebtToPlatform`.
 *
 * `adsFees` are the days of sponsored placement the store ran this period
 * (see `adsFeesByStore` in `lib/ads/billing.ts`). Like a plan fee, an ads
 * fee alone produces a row: the store owes it whether or not it sold.
 *
 * `carries` are debts from earlier periods (see `lib/payouts/carry.ts`). They
 * only land on a store that has a row for some other reason (a sale, an
 * adjustment, a plan fee or an ads fee), so a dormant store does not get a
 * new row every period that merely restates what it owes.
 */
export function summarizePayouts(
  orders: readonly PayoutOrderInput[],
  { periodStart, periodEnd }: PayoutPeriod,
  adjustments: readonly PayoutAdjustmentInput[] = [],
  planFees: readonly PlanFeeInput[] = [],
  carries: readonly CarryInput[] = [],
  adsFees: readonly AdsFeeInput[] = [],
): PayoutSummaryRow[] {
  const fromMs = periodStartMs(periodStart)
  const toExclusiveMs = periodEndExclusive(periodEnd).getTime()

  type Totals = {
    gross: number
    commission: number
    cash_collected: number
    plan_fee: number
    ads_fee: number
    delivery_and_tips: number
    carried_in: number
  }
  const totals = new Map<string, Totals>()
  const entryOf = (storeId: string): Totals => {
    const entry = totals.get(storeId) ?? {
      gross: 0,
      commission: 0,
      cash_collected: 0,
      plan_fee: 0,
      ads_fee: 0,
      delivery_and_tips: 0,
      carried_in: 0,
    }
    totals.set(storeId, entry)
    return entry
  }

  for (const order of orders) {
    if (!isEligible(order)) continue
    if (!inPeriod(order.delivered_at, fromMs, toExclusiveMs)) continue

    const entry = entryOf(order.store_id)
    entry.gross += settledGross(order)
    entry.commission += order.platform_fee
    if (isCollectedByMerchant(order))
      entry.cash_collected += collectedAmount(order)
    if (isPassedThroughToMerchant(order))
      entry.delivery_and_tips += passthroughAmount(order)
  }

  for (const adjustment of adjustments) {
    const entry = entryOf(adjustment.store_id)
    entry.gross += adjustment.gross
    entry.commission += adjustment.commission
    entry.cash_collected += adjustment.cash_collected
    entry.delivery_and_tips += adjustment.delivery_and_tips
  }

  // A plan fee alone still produces a row: a store that sold nothing this
  // period owes its plan all the same.
  for (const fee of planFees) {
    if (fee.plan_fee <= 0) continue
    entryOf(fee.store_id).plan_fee += fee.plan_fee
  }

  // Same for an ads fee: the days ran, so they are owed.
  for (const fee of adsFees) {
    if (fee.ads_fee <= 0) continue
    entryOf(fee.store_id).ads_fee += fee.ads_fee
  }

  // Last, and only onto rows that already exist: a carry never creates one.
  for (const carry of carries) {
    const entry = totals.get(carry.store_id)
    if (entry) entry.carried_in += carry.carried_in
  }

  return [...totals.entries()]
    .map(([store_id, entry]) => ({
      store_id,
      period_start: periodStart,
      period_end: periodEnd,
      ...entry,
      net: payoutNet(entry),
    }))
    .sort((a, b) => a.store_id.localeCompare(b.store_id))
}
