// Carrying unpaid merchant debt forward. Pure: no React, no Supabase.
//
// A payout with a negative net is a debt to the platform: the merchant sold
// mostly in cash (so the commission was never withheld) or owes the plan's
// monthly fee. Nothing transfers money the other way, so before this module
// that row simply sat `pending` forever and the debt was never collected.
//
// Now the next payout generated for that store takes the open debt in as
// `carried_in` (≤ 0) and stamps the old row with `carried_into_payout_id`, so:
//
//   * the debt is withheld from whatever the platform owes the store next;
//   * each debt is carried exactly once (the stamp), and a chain R1 → R2 → R3
//     leaves only the newest row open, so nothing is ever counted twice;
//   * a carried row can no longer be marked paid: it was settled by the row
//     it moved into (enforced by `payouts_carried_stays_pending` in SQL and
//     by `markPayoutPaid`).
//
// MIRRORED IN SQL. `public.generate_payouts` applies the same rule inside its
// transaction; see `CARRYABLE_RULE` in `lib/payouts/sql.ts` and
// `tests/payouts-sql-drift.test.ts`.
import type { CarryInput, PayoutPeriod } from '@/lib/payouts/compute'
import type { PayoutStatus } from '@/types/app'

/** The payout fields the carry rule reads. */
export interface CarryCandidate {
  id: string
  store_id: string
  status: PayoutStatus
  net: number
  /** Inclusive, date-only (`YYYY-MM-DD`). */
  period_end: string
  carried_into_payout_id: string | null
}

/**
 * Whether `row` is an open debt that a payout for `period` should take in.
 *
 * Only rows that ended before the period starts: an admin may generate an old
 * period, and moving a later debt into a week that closed before it existed
 * would put the correction before the event, the same rule `planReversals`
 * applies to refunds. Date-only strings compare correctly as text.
 */
export function isCarryable(
  row: CarryCandidate,
  period: Pick<PayoutPeriod, 'periodStart'>,
): boolean {
  return (
    row.status === 'pending' &&
    row.net < 0 &&
    row.carried_into_payout_id === null &&
    row.period_end < period.periodStart
  )
}

export interface CarryPlan extends CarryInput {
  /** The rows the new payout will stamp as carried. */
  payout_ids: string[]
}

/**
 * Per-store debts a payout for `period` carries in, restricted to the stores
 * that will get a row this period (`storesWithActivity`). A dormant store's
 * debt stays open and visible instead of producing an empty row each period.
 */
export function planCarries(
  rows: readonly CarryCandidate[],
  period: Pick<PayoutPeriod, 'periodStart'>,
  storesWithActivity: ReadonlySet<string>,
): CarryPlan[] {
  const byStore = new Map<string, CarryPlan>()
  for (const row of rows) {
    if (!isCarryable(row, period)) continue
    if (!storesWithActivity.has(row.store_id)) continue
    const plan = byStore.get(row.store_id) ?? {
      store_id: row.store_id,
      carried_in: 0,
      payout_ids: [],
    }
    plan.carried_in += row.net
    plan.payout_ids.push(row.id)
    byStore.set(row.store_id, plan)
  }
  return [...byStore.values()].sort((a, b) =>
    a.store_id.localeCompare(b.store_id),
  )
}

/**
 * What each store still owes, right now: the sum of its open debts (pending,
 * negative, not yet carried). A positive number, for display.
 */
export function openDebtByStore(
  rows: readonly Omit<CarryCandidate, 'period_end'>[],
): Map<string, number> {
  const debts = new Map<string, number>()
  for (const row of rows) {
    if (row.status !== 'pending') continue
    if (row.carried_into_payout_id !== null) continue
    if (!(row.net < 0)) continue
    debts.set(row.store_id, (debts.get(row.store_id) ?? 0) - row.net)
  }
  return debts
}

export type PayoutDisplayStatus = PayoutStatus | 'carried'

/** `carried` reads as its own state: the row is closed, but was not paid. */
export function payoutDisplayStatus(
  row: Pick<CarryCandidate, 'status' | 'carried_into_payout_id'>,
): PayoutDisplayStatus {
  return row.carried_into_payout_id !== null ? 'carried' : row.status
}
