// ===========================================================================
// WARNING: THIS MODULE MIRRORS BUSINESS RULES INTO SQL. READ THIS FIRST.
// ===========================================================================
//
// Payout generation runs as ONE database transaction
// (`public.generate_payouts`, added by
// `supabase/migrations/20260919000500_money_transactions.sql`). That is not a
// performance choice: generation reads which orders are eligible, works out
// which refunds still owe a clawback, inserts the payout rows and stamps the
// refunds those rows carried. Done as four round trips from JavaScript, any
// interruption between them leaves money state that disagrees with itself —
// a merchant paid for a sale that was refunded in the gap, or a refund
// re-clawed back on every run forever.
//
// A transaction cannot span PostgREST calls, so the decisions have to be made
// where the transaction is: inside the function. That means the rules below
// exist twice — once in `lib/payouts/compute.ts` and `lib/payouts/reversal.ts`
// as the source of truth the rest of the app reads, and once in SQL. THIS IS
// DUPLICATION, AND DUPLICATED RULES DRIFT.
//
// So it is duplication with a tripwire, the same shape
// `lib/payments/unapplied-events.ts` uses for the psql audit script:
//
//   * every rule below carries `sql` and `matches` side by side;
//   * `matches` is compared against the real TypeScript rule over an
//     exhaustive input space in `tests/payouts-sql-drift.test.ts`;
//   * the migration embeds the emitted `sql` between `codegen:` markers, and
//     the same test compares the file against this module byte for byte.
//
// Change a rule in `compute.ts` or `reversal.ts` and the test fails until the
// mirror and the migration follow. Never hand-edit the generated blocks in
// the migration: change the rule, run the test, paste the new output in.
//
// Pure: no React, no Supabase, safe on client and server.
import type { PayoutOrderInput } from '@/lib/payouts/compute'
import { REFUND_REVERSES_PLATFORM_FEE } from '@/lib/payouts/reversal'

/**
 * Date-only period bounds, in UTC.
 *
 * `periodEndExclusive` in `compute.ts` builds `YYYY-MM-DDT00:00:00.000Z`, so
 * the SQL must pin UTC too. A bare `period_start::timestamptz` would be read
 * in the *session's* time zone and silently shift every period boundary by
 * the deployment's offset, which for Colombia is five hours of orders landing
 * in the wrong week.
 */
export function periodStartSql(column: string): string {
  return `(${column}::timestamp at time zone 'UTC')`
}

export function periodEndExclusiveSql(column: string): string {
  return `((${column} + 1)::timestamp at time zone 'UTC')`
}

/**
 * Mirror of `isEligible` in `lib/payouts/compute.ts`, against `orders o`.
 *
 * Eligible = delivered AND not refunded AND (paid electronically OR cash).
 * A cash order never turns `paid` — the customer hands the money over at the
 * door — so it settles on delivery instead.
 */
export const PAYOUT_ELIGIBLE_RULE = {
  sql: [
    "o.status = 'delivered'",
    "    and o.payment_status <> 'refunded'",
    "    and (o.payment_status = 'paid' or o.payment_method = 'cash')",
  ].join('\n'),
  matches: (order: PayoutOrderInput): boolean =>
    order.status === 'delivered' &&
    order.payment_status !== 'refunded' &&
    (order.payment_status === 'paid' || order.payment_method === 'cash'),
}

/**
 * Mirror of `needsReversal` in `lib/payouts/reversal.ts`, against a refund `r`
 * joined to its order `o`.
 *
 * True only when a payout for that store already covered the delivery date
 * AND was generated before the refund was recorded. Refunded-then-generated
 * never reached a payout (the eligibility rule above dropped it), so there is
 * nothing to claw back; generated-then-refunded is the case that owes money.
 */
export const REVERSAL_NEEDED_RULE = {
  sql: [
    'exists (',
    '      select 1',
    '      from public.payouts settled',
    '      where settled.store_id = r.store_id',
    `        and o.delivered_at >= ${periodStartSql('settled.period_start')}`,
    `        and o.delivered_at < ${periodEndExclusiveSql('settled.period_end')}`,
    '        and settled.created_at <= r.issued_at',
    '    )',
  ].join('\n'),
}

/**
 * Mirror of `reverseRefundedOrder`'s commission half, i.e. of the
 * `REFUND_REVERSES_PLATFORM_FEE` decision in `lib/payouts/reversal.ts`.
 *
 * Flipping that constant changes this string, which fails the drift test
 * until the migration is regenerated — which is the point: the constant must
 * not be able to mean one thing to the app and another to the ledger.
 */
export function reversalCommissionSql(): string {
  return REFUND_REVERSES_PLATFORM_FEE ? '-o.platform_fee' : '0'
}

/** The blocks the migration embeds, by `codegen:` marker name. */
export function payoutSqlBlocks(): Record<string, string> {
  return {
    eligible: PAYOUT_ELIGIBLE_RULE.sql,
    reversal_needed: REVERSAL_NEEDED_RULE.sql,
    reversal_commission: reversalCommissionSql(),
  }
}
