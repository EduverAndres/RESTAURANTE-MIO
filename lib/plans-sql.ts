// ===========================================================================
// MIRRORS THE PLAN RULES INTO SQL. Same discipline as lib/payouts/sql.ts.
// ===========================================================================
//
// `platformFeePct` and `billableDays` in lib/plans.ts are the source of
// truth. The database applies them inside triggers and inside the payout
// transaction, so each rule also exists here as SQL, with a `matches` twin
// that reads the way the SQL does. tests/plans-sql-drift.test.ts compares
// every twin against the real rule over its input space, and compares the
// migrations against these strings byte for byte between `codegen:` markers.
// Never hand-edit a generated block in a migration: change the rule here,
// run the test, paste the output in.
//
// Pure: no React, no Supabase.
import {
  isFounderActive,
  type DatePeriod,
  type FeeOrder,
  type FeeStore,
} from '@/lib/plans'

/**
 * Mirror of `platformFeePct`, as it runs inside `compute_order_totals`
 * (migration 20261105000100). `s_commission`, `s_online` and
 * `s_founder_until` are the store's columns, read into variables first.
 * `at time zone 'America/Bogota'` reads the founder date on the merchant's
 * calendar, like `bogotaDate` does.
 */
export const FEE_PCT_RULE = {
  sql: [
    '(case',
    "      when new.type = 'table' then 0",
    '      when s_founder_until is not null',
    "        and (coalesce(new.created_at, now()) at time zone 'America/Bogota')::date <= s_founder_until then 0",
    '      else coalesce(s_commission, 0)',
    '    end)',
    "    + (case when new.payment_method = 'cash' then 0 else coalesce(s_online, 0) end)",
  ].join('\n'),
  matches: (order: FeeOrder, store: FeeStore): number => {
    const base =
      order.type === 'table'
        ? 0
        : store.founder_until !== null &&
            isFounderActive(store.founder_until, new Date(order.created_at))
          ? 0
          : store.commission_pct
    const online =
      order.payment_method === 'cash' ? 0 : store.online_payment_pct
    return base + online
  },
}

function dayNumber(dateOnly: string): number {
  return Math.round(
    new Date(`${dateOnly}T00:00:00.000Z`).getTime() / 86_400_000,
  )
}

/**
 * Mirror of `billableDays`, as it runs inside `generate_payouts` (migration
 * 20261105000200), against `stores s`. In SQL `date - date` is a whole
 * number of days, so the arithmetic is the same as the JavaScript one.
 */
export const BILLABLE_DAYS_RULE = {
  sql: 'greatest(0, p_period_end - greatest(p_period_start, coalesce(s.founder_until + 1, p_period_start)) + 1)',
  matches: (period: DatePeriod, founderUntil: string | null): number => {
    const start = dayNumber(period.periodStart)
    const end = dayNumber(period.periodEnd)
    const firstBilled = Math.max(
      start,
      founderUntil === null ? start : dayNumber(founderUntil) + 1,
    )
    return Math.max(0, end - firstBilled + 1)
  },
}

/** Blocks embedded in the plans migration, by `codegen:` marker name. */
export function planSqlBlocks(): Record<string, string> {
  return { fee_pct: FEE_PCT_RULE.sql }
}
