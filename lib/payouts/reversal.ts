// Reversing a settled sale. Pure: no React, no Supabase.
//
// ---------------------------------------------------------------------------
// The problem this exists for
// ---------------------------------------------------------------------------
// `isEligible` in `lib/payouts/compute.ts` drops an order whose
// `payment_status` is `refunded`, so an order refunded BEFORE its period was
// generated never reaches a payout at all. An order refunded AFTER
// `generatePayouts` ran is a different story: the payout row already carries
// it, and re-running generation for that period hits the unique index on
// (store_id, period_start, period_end) and is skipped, so nothing self-heals.
// The merchant has been paid for a sale that no longer exists.
//
// ---------------------------------------------------------------------------
// Why a negative adjustment and not an edit
// ---------------------------------------------------------------------------
// The obvious fix — go back and correct the settled payout row — destroys the
// audit trail: the row stops describing the transfer that actually happened,
// and a payout already marked `paid` would start disagreeing with the bank.
// Settled rows are immutable here. The reversal rides into the NEXT generated
// period as a negative adjustment, the way an accounting correction is a new
// entry rather than an eraser.
//
// `refunds.reversed_in_payout_id` records which payout carried which
// reversal, so a refund is carried exactly once.
import {
  periodEndExclusive,
  type PayoutPeriod,
} from '@/lib/payouts/compute'

// ---------------------------------------------------------------------------
// THE DECISION POINT
// ---------------------------------------------------------------------------
/**
 * Does the platform keep its commission when an order is fully refunded?
 *
 * `true` (the current assumption): it does NOT. The sale did not happen, so
 * `platform_fee` reverses along with the subtotal and the merchant gives back
 * exactly the `net` they were paid — the platform absorbs its own commission
 * as the cost of a reversed sale.
 *
 * `false`: the platform keeps the fee. The merchant then gives back their
 * full `subtotal` instead of their `net`, so the reversal costs them the
 * commission a second time.
 *
 * This is the only place that choice is made. Flipping this constant is the
 * entire change; nothing else in the module inspects it.
 */
export const REFUND_REVERSES_PLATFORM_FEE = true

/** A refunded order, with the settlement figures it used to contribute. */
export interface RefundedOrderInput {
  refund_id: string
  order_id: string
  store_id: string
  /** What the merchant was settled on, in pesos. */
  subtotal: number
  /** The commission the platform charged on that subtotal, in pesos. */
  platform_fee: number
  /** Decides which settlement period the order belonged to. */
  delivered_at: string | null
  /** When the refund was recorded (`refunds.issued_at`). */
  refunded_at: string
}

/** A payout row that already exists, from an earlier generation run. */
export interface SettledPayout {
  store_id: string
  /** Inclusive, date-only (`YYYY-MM-DD`). */
  period_start: string
  /** Inclusive, date-only (`YYYY-MM-DD`). */
  period_end: string
  /** When the row was generated; decides what it could have included. */
  created_at: string
}

/** A negative entry to fold into the period currently being generated. */
export interface PayoutAdjustment {
  refund_id: string
  order_id: string
  store_id: string
  /** Negative: removes a gross the merchant was settled on. */
  gross: number
  /** Negative, or 0 when the platform keeps its commission. */
  commission: number
  /** `gross - commission`: what the merchant has to give back. */
  net: number
}

/**
 * The reversal of one refunded order.
 *
 * `net = gross - commission` is the same arithmetic `summarizePayouts` uses,
 * which is what makes the adjustment fold into a period without a special
 * case: with the commission reversed the merchant returns exactly the `net`
 * they were paid; without it they return their whole `subtotal`.
 */
export function reverseRefundedOrder(
  order: RefundedOrderInput,
): PayoutAdjustment {
  const gross = -order.subtotal
  const commission = REFUND_REVERSES_PLATFORM_FEE ? -order.platform_fee : 0
  return {
    refund_id: order.refund_id,
    order_id: order.order_id,
    store_id: order.store_id,
    gross,
    commission,
    net: gross - commission,
  }
}

function coversDelivery(payout: SettledPayout, deliveredAt: string): boolean {
  const time = new Date(deliveredAt).getTime()
  return (
    time >= new Date(`${payout.period_start}T00:00:00.000Z`).getTime() &&
    time < periodEndExclusive(payout.period_end).getTime()
  )
}

/**
 * Whether this refund still has money to claw back.
 *
 * True only when a payout for the order's store already covered the delivery
 * date AND was generated before the refund was recorded. The second half is
 * what separates the two cases that look identical in the data afterwards:
 *
 *   * refunded first, generated later — generation already excluded the order
 *     through `isEligible`, so the merchant was never paid for it and there
 *     is nothing to reverse;
 *   * generated first, refunded later — the payout carries it, so the
 *     reversal is owed. Whether that payout has since been marked `paid`
 *     makes no difference: the row is immutable either way.
 *
 * An order that was never delivered, or whose period has not been generated,
 * answers false: a future generation run will simply exclude it.
 */
export function needsReversal(
  order: RefundedOrderInput,
  payouts: readonly SettledPayout[],
): boolean {
  if (!order.delivered_at) return false
  const deliveredAt = order.delivered_at
  return payouts.some(
    (payout) =>
      payout.store_id === order.store_id &&
      coversDelivery(payout, deliveredAt) &&
      new Date(payout.created_at).getTime() <=
        new Date(order.refunded_at).getTime(),
  )
}

export interface ReversalPlan {
  /** Negative entries to fold into the period being generated. */
  adjustments: PayoutAdjustment[]
  /**
   * Every refund considered, whether or not it produced an adjustment.
   *
   * The ones that produced none are still stamped with the payout that
   * "carried" them, because they never will produce one — leaving them
   * pending would make every future generation reconsider them forever.
   */
  resolvedRefundIds: string[]
}

/**
 * Splits pending refunds into what must be clawed back and what must not.
 *
 * `period`, when given, is the period being generated. A refund recorded
 * after that period ended is left pending: the admin may generate any
 * period, including an old one, and dropping a later reversal into a week
 * that was already closed would put the correction before the event it
 * corrects. It waits for a period that could contain it.
 */
export function planReversals(
  refunds: readonly RefundedOrderInput[],
  payouts: readonly SettledPayout[],
  period?: PayoutPeriod,
): ReversalPlan {
  const carryBeforeMs = period
    ? periodEndExclusive(period.periodEnd).getTime()
    : Number.POSITIVE_INFINITY

  const adjustments: PayoutAdjustment[] = []
  const resolvedRefundIds: string[] = []
  for (const refund of refunds) {
    if (new Date(refund.refunded_at).getTime() >= carryBeforeMs) continue
    resolvedRefundIds.push(refund.refund_id)
    if (needsReversal(refund, payouts)) {
      adjustments.push(reverseRefundedOrder(refund))
    }
  }
  return { adjustments, resolvedRefundIds }
}

/**
 * True when the period ends up owing the platform instead of the other way
 * round — the over-refund case.
 *
 * Nothing clamps a payout at zero. A merchant who refunded more than they
 * sold this period really does owe the difference, and a payout silently
 * floored at zero would forgive it without anyone deciding to: the platform
 * would be out the money and no row would say so. The debt is carried as a
 * negative payout, and this is what the UI reads to name it out loud.
 *
 * `markPayoutPaid` on such a row therefore means "this debt was settled",
 * not "we transferred a negative amount".
 */
export function isDebtToPlatform(row: { net: number }): boolean {
  return row.net < 0
}
