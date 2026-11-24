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
import type { AdPauseSpan, BillableCampaign } from '@/lib/ads/billing'
import { dayNumber } from '@/lib/ads/pricing'
import { AD_BILLED_STATUSES } from '@/lib/ads/vocabulary'
import { BILLABLE_DAYS_RULE } from '@/lib/plans-sql'
import { bogotaDate, type DatePeriod } from '@/lib/plans'
import type { CarryCandidate } from '@/lib/payouts/carry'
import type { PayoutOrderInput } from '@/lib/payouts/compute'
import { REFUND_REVERSES_PLATFORM_FEE } from '@/lib/payouts/reversal'
import { sqlValueList } from '@/lib/refunds/vocabulary'
import { addDays } from '@/lib/store/hours'

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

/**
 * Mirror of `isCollectedByMerchant` in `lib/payouts/compute.ts`, against
 * `orders o`: a cash sale handed over by the merchant (counter, table, or a
 * delivery without a platform courier) is money already in their till.
 */
export const MERCHANT_COLLECTED_RULE = {
  sql: "o.payment_method = 'cash' and (o.type <> 'delivery' or o.courier_id is null)",
  matches: (
    order: Pick<PayoutOrderInput, 'payment_method' | 'type' | 'courier_id'>,
  ): boolean =>
    order.payment_method === 'cash' &&
    (order.type !== 'delivery' || order.courier_id === null),
}

/**
 * Mirror of `isPassedThroughToMerchant` in `lib/payouts/compute.ts`, against
 * `orders o`: an order paid online and handed over without a platform courier,
 * whose delivery fee and tip the platform holds on the merchant's behalf.
 */
export const MERCHANT_PASSTHROUGH_RULE = {
  sql: "o.payment_method <> 'cash' and (o.type <> 'delivery' or o.courier_id is null)",
  matches: (
    order: Pick<PayoutOrderInput, 'payment_method' | 'type' | 'courier_id'>,
  ): boolean =>
    order.payment_method !== 'cash' &&
    (order.type !== 'delivery' || order.courier_id === null),
}

/** Mirror of `passthroughAmount` in `lib/payouts/compute.ts`. */
export const PASSTHROUGH_AMOUNT_SQL = '(o.delivery_fee + o.tip)'

/**
 * Mirror of `isCarryable` in `lib/payouts/carry.ts`, against an earlier payout
 * `prev`, for the period starting at `p_period_start`.
 */
export const CARRYABLE_RULE = {
  sql: "prev.status = 'pending' and prev.net < 0 and prev.carried_into_payout_id is null and prev.period_end < p_period_start",
  matches: (row: CarryCandidate, periodStart: string): boolean =>
    row.status === 'pending' &&
    row.net < 0 &&
    row.carried_into_payout_id === null &&
    row.period_end < periodStart,
}

/**
 * Mirror of `payoutNet` in `lib/payouts/compute.ts`, against the per-store
 * `totals t` and the carried debt `ct` of `generate_payouts`.
 */
export const PAYOUT_NET_SQL =
  't.gross - t.commission - t.cash_collected - t.plan_fee - t.ads_fee + t.delivery_and_tips + coalesce(ct.carried_in, 0)'

// ---------------------------------------------------------------------------
// Paid placements (supabase/migrations/20261124000900_ad_campaigns.sql)
// ---------------------------------------------------------------------------

/** A timestamp column read as a Bogotá calendar date, like `bogotaDate`. */
function bogotaDateSql(column: string): string {
  return `(${column} at time zone 'America/Bogota')::date`
}

/** Mirror of `isAdBilled`: the statuses `ads_fees` charges. */
export const AD_BILLED_STATUSES_SQL = sqlValueList(AD_BILLED_STATUSES)

// The campaign's charged window inside the period, before pauses: from the
// later of its first day and the period's, to the earliest of its last day,
// the day before an early end, and the period's last day.
const AD_FIRST_DAY_SQL = 'greatest(c.starts_on, p_period_start)'
const AD_LAST_DAY_SQL = `least(c.ends_on, coalesce(${bogotaDateSql('c.ended_at')} - 1, c.ends_on), p_period_end)`

/**
 * Mirror of `adBillableDays` in `lib/ads/billing.ts`, against a campaign `c`
 * and the period `p_period_start`..`p_period_end` of `generate_payouts`.
 *
 * The TypeScript rule counts day by day; the SQL subtracts the paused days
 * from the window, clipping each pause to it. They agree because a campaign
 * has at most one open pause at a time (`ad_campaign_pauses_open_key`), so
 * its pauses never overlap: a pause covers the day it started up to the day
 * before it was lifted, and the next one cannot start before that.
 * `matches` reads the way the SQL does; tests/ads-billing.test.ts compares it
 * with `adBillableDays` over every combination.
 */
export const AD_BILLABLE_DAYS_RULE = {
  sql: [
    `greatest(0, ${AD_LAST_DAY_SQL} - ${AD_FIRST_DAY_SQL} + 1)`,
    '      - coalesce((',
    `        select sum(greatest(0, least(${AD_LAST_DAY_SQL}, coalesce(${bogotaDateSql('pz.resumed_at')} - 1, p_period_end)) - greatest(${AD_FIRST_DAY_SQL}, ${bogotaDateSql('pz.paused_at')}) + 1))`,
    '        from public.ad_campaign_pauses pz',
    '        where pz.campaign_id = c.id',
    '      ), 0)',
  ].join('\n'),
  matches: (
    campaign: Pick<BillableCampaign, 'starts_on' | 'ends_on' | 'ended_at'>,
    pauses: readonly AdPauseSpan[],
    period: DatePeriod,
  ): number => {
    const least = (...days: string[]) => days.reduce((a, b) => (b < a ? b : a))
    const greatest = (...days: string[]) =>
      days.reduce((a, b) => (b > a ? b : a))
    const span = (from: string, to: string) =>
      Math.max(0, dayNumber(to) - dayNumber(from) + 1)
    const first = greatest(campaign.starts_on, period.periodStart)
    const last = least(
      campaign.ends_on,
      campaign.ended_at === null
        ? campaign.ends_on
        : addDays(bogotaDate(new Date(campaign.ended_at)), -1),
      period.periodEnd,
    )
    const paused = pauses.reduce(
      (total, pause) =>
        total +
        span(
          greatest(first, bogotaDate(new Date(pause.paused_at))),
          least(
            last,
            pause.resumed_at === null
              ? period.periodEnd
              : addDays(bogotaDate(new Date(pause.resumed_at)), -1),
          ),
        ),
      0,
    )
    return span(first, last) - paused
  },
}

/**
 * Mirror of `isAdRunning` in `lib/ads/billing.ts`, against a campaign `c`
 * and the Bogotá date `v_today`. Used where a campaign is shown
 * (`sponsored_stores`) and where its clicks are counted (`record_ad_click`).
 */
export const AD_RUNNING_RULE = {
  sql: "c.status = 'active' and c.starts_on <= v_today and c.ends_on >= v_today",
  matches: (
    campaign: Pick<BillableCampaign, 'status' | 'starts_on' | 'ends_on'>,
    today: string,
  ): boolean =>
    campaign.status === 'active' &&
    campaign.starts_on <= today &&
    campaign.ends_on >= today,
}

/** Mirror of `settledGross` in `lib/payouts/compute.ts`, against `orders o`. */
export const SETTLED_GROSS_SQL = '(o.subtotal - o.merchant_discount)'

/** Mirror of `collectedAmount` in `lib/payouts/compute.ts`. */
export const COLLECTED_AMOUNT_SQL =
  '(o.subtotal - o.merchant_discount - o.platform_discount)'

/**
 * The blocks the settlement migration embeds, by `codegen:` marker name.
 * `merchant_collected` appears twice in `generate_payouts` (the sale and
 * its reversal), so it is emitted under two marker names.
 */
export function payoutSqlBlocks(): Record<string, string> {
  return {
    eligible: PAYOUT_ELIGIBLE_RULE.sql,
    reversal_needed: REVERSAL_NEEDED_RULE.sql,
    reversal_commission: reversalCommissionSql(),
    merchant_collected: MERCHANT_COLLECTED_RULE.sql,
    reversal_merchant_collected: MERCHANT_COLLECTED_RULE.sql,
    billable_days: BILLABLE_DAYS_RULE.sql,
    settled_gross: SETTLED_GROSS_SQL,
    reversal_settled_gross: SETTLED_GROSS_SQL,
    collected_amount: COLLECTED_AMOUNT_SQL,
    reversal_collected_amount: COLLECTED_AMOUNT_SQL,
    merchant_passthrough: MERCHANT_PASSTHROUGH_RULE.sql,
    reversal_merchant_passthrough: MERCHANT_PASSTHROUGH_RULE.sql,
    passthrough_amount: PASSTHROUGH_AMOUNT_SQL,
    reversal_passthrough_amount: PASSTHROUGH_AMOUNT_SQL,
    // Twice: once to lock the rows before the snapshot, once to read them.
    carryable_lock: CARRYABLE_RULE.sql,
    carryable: CARRYABLE_RULE.sql,
    payout_net: PAYOUT_NET_SQL,
    // Paid placements (v4): what the period charges, and what is on the air.
    ad_billed_statuses: AD_BILLED_STATUSES_SQL,
    ad_billable_days: AD_BILLABLE_DAYS_RULE.sql,
    ad_running_sponsored: AD_RUNNING_RULE.sql,
    ad_running_click: AD_RUNNING_RULE.sql,
  }
}
