// The courier ledger: what the platform owes each courier and what each
// courier owes the platform. Pure: no React, no Supabase.
//
// Two flows meet here:
//
//   * a delivery the customer paid online leaves the courier's delivery fee
//     and tip in the platform's hands: the platform owes them (`earnings`);
//   * a cash delivery puts the whole total in the courier's hands, but only
//     the delivery fee and tip are theirs: the rest belongs to the merchant
//     (whom the platform settles as if it had been paid) and the platform's
//     commission. So the courier owes `cash_collected - earnings`.
//
// Deposits (the courier hands cash over) and admin adjustments are signed
// `amount`s. A period's net is
//
//   net = earnings - cash_collected + adjustments + carried_in
//
// positive: the platform pays the courier; negative: the courier owes, and it
// is carried into their next period like a merchant's debt (see
// `lib/payouts/carry.ts`, whose rule is reused as is).
//
// MIRRORED IN SQL: the delivery trigger and `generate_courier_payouts` in
// supabase/migrations/20261124000300_courier_ledger.sql
// (lib/couriers/sql.ts, tests/couriers-ledger-sql-drift.test.ts).
import type {
  OrderStatus,
  OrderType,
  PaymentMethod,
  PaymentStatus,
} from '@/types/app'

/**
 * A refund never touches the courier's ledger: the courier made the delivery
 * either way, and on a cash order they still hold the cash. Who absorbs a
 * refund is settled between the platform and the merchant (lib/payouts).
 */
export const REFUND_KEEPS_COURIER_EARNINGS = true

export interface CourierLedgerOrder {
  status: OrderStatus
  type: OrderType
  courier_id: string | null
  payment_method: PaymentMethod
  payment_status: PaymentStatus
  delivery_fee: number
  tip: number
  total: number
}

/**
 * Whether a delivered order makes a ledger entry: a platform courier took it,
 * and either the cash is in their hands or the customer's online payment
 * went through (a later refund does not undo the delivery).
 */
export function isCourierEntryEligible(order: CourierLedgerOrder): boolean {
  return (
    order.status === 'delivered' &&
    order.type === 'delivery' &&
    order.courier_id !== null &&
    (order.payment_method === 'cash' ||
      order.payment_status === 'paid' ||
      order.payment_status === 'refunded')
  )
}

/** The entry a delivery makes. */
export function courierEntryFor(
  order: Pick<
    CourierLedgerOrder,
    'payment_method' | 'delivery_fee' | 'tip' | 'total'
  >,
): { earnings: number; cash_collected: number } {
  return {
    earnings: order.delivery_fee + order.tip,
    cash_collected: order.payment_method === 'cash' ? order.total : 0,
  }
}

/** What a courier will owe once they deliver a cash order they hold. */
export function cashOwedFor(
  order: Pick<
    CourierLedgerOrder,
    'payment_method' | 'delivery_fee' | 'tip' | 'total'
  >,
): number {
  const entry = courierEntryFor(order)
  return Math.max(0, entry.cash_collected - entry.earnings)
}

export interface LedgerEntry {
  kind: 'delivery' | 'deposit' | 'adjustment'
  earnings: number
  cash_collected: number
  /** Signed. A deposit is positive: it pays the courier's debt down. */
  amount: number
}

/**
 * Net position of a set of entries: positive when the platform owes the
 * courier, negative when the courier owes the platform.
 */
export function ledgerBalance(entries: readonly LedgerEntry[]): number {
  return entries.reduce(
    (sum, entry) => sum + entry.earnings - entry.cash_collected + entry.amount,
    0,
  )
}

/**
 * A courier payout's net. MIRRORED IN SQL (`COURIER_PAYOUT_NET_SQL`).
 */
export function courierPayoutNet(parts: {
  earnings: number
  cash_collected: number
  adjustments: number
  carried_in: number
}): number {
  return (
    parts.earnings - parts.cash_collected + parts.adjustments + parts.carried_in
  )
}

/**
 * The courier's cash exposure: what they owe on entries and payouts not yet
 * settled, plus what they will owe on cash orders they are carrying right
 * now. `balance` is the signed position (see `ledgerBalance`, plus open
 * payouts); a courier the platform owes money has that much headroom.
 */
export function cashExposure({
  balance,
  inProgressOwed,
}: {
  balance: number
  inProgressOwed: number
}): number {
  return inProgressOwed - balance
}

/**
 * Whether taking one more cash order would put the courier over the cap.
 * MIRRORED IN SQL in the claim guard of `orders`.
 */
export function isOverCashCap({
  exposure,
  newOrderOwed,
  cap,
}: {
  exposure: number
  newOrderOwed: number
  cap: number
}): boolean {
  return exposure + newOrderOwed > cap
}
