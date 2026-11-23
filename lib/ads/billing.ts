// What a campaign is charged in a settlement period, and whether it is on the
// air right now. Pure: no React, no Supabase.
//
// The merchant pays per day, by the Bogotá calendar, and only for days that
// ran. The rule, in one sentence a merchant can check: a day is charged when
// the campaign starts or keeps running that day; the day it is paused or
// ended is not. So
//
//   * days before `starts_on` and after `ends_on` are never charged;
//   * when an admin ends a campaign early, its last charged day is the day
//     before (`ended_at`, read in Bogotá);
//   * a pause covers the day it started up to the day before it was lifted,
//     so a pause lifted the same day costs nothing and charges nothing.
//
// The fee is withheld in the store's payout, like the plan's monthly fee:
// `payouts.ads_fee`, subtracted from `net`.
//
// MIRRORED IN SQL. `public.generate_payouts` (v4, migration
// 20261124000900_ad_campaigns.sql) charges the same days inside its
// transaction; see `AD_BILLABLE_DAYS_RULE` and `AD_RUNNING_RULE` in
// lib/payouts/sql.ts and tests/ads-billing.test.ts.
import { dayNumber } from '@/lib/ads/pricing'
import {
  AD_BILLED_STATUSES,
  type AdDisplayStatus,
  type AdStatus,
} from '@/lib/ads/vocabulary'
import { bogotaDate, type DatePeriod } from '@/lib/plans'
import { addDays } from '@/lib/store/hours'

export interface BillableCampaign {
  status: AdStatus
  /** Inclusive Bogotá dates. */
  starts_on: string
  ends_on: string
  /** When an admin ended the campaign; null otherwise. */
  ended_at: string | null
  /** Whole pesos per day, frozen when the merchant asked. */
  daily_price: number
}

export interface AdPauseSpan {
  paused_at: string
  /** Null while the pause lasts. */
  resumed_at: string | null
}

/** The Bogotá calendar date of an instant. */
function bogotaDay(instant: string): string {
  return bogotaDate(new Date(instant))
}

/** The last day a campaign may be charged for, before pauses. */
export function lastChargeableDay(
  campaign: Pick<BillableCampaign, 'ends_on' | 'ended_at'>,
): string {
  if (campaign.ended_at === null) return campaign.ends_on
  const dayBefore = addDays(bogotaDay(campaign.ended_at), -1)
  return dayBefore < campaign.ends_on ? dayBefore : campaign.ends_on
}

/** Whether `day` (Bogotá) falls inside a pause. */
export function isPausedOn(pause: AdPauseSpan, day: string): boolean {
  if (day < bogotaDay(pause.paused_at)) return false
  if (pause.resumed_at === null) return true
  return day < bogotaDay(pause.resumed_at)
}

/** Whether a campaign in this status is charged at all. */
export function isAdBilled(status: AdStatus): boolean {
  return AD_BILLED_STATUSES.includes(status)
}

/**
 * The days of `period` a campaign is charged for, counted one by one: inside
 * its dates, before an early end and outside every pause. Status-blind: the
 * caller decides whether the status is billed (`adFeeForPeriod`).
 */
export function adBillableDays(
  campaign: Pick<BillableCampaign, 'starts_on' | 'ends_on' | 'ended_at'>,
  pauses: readonly AdPauseSpan[],
  period: DatePeriod,
): number {
  const first =
    campaign.starts_on > period.periodStart
      ? campaign.starts_on
      : period.periodStart
  const lastChargeable = lastChargeableDay(campaign)
  const last =
    lastChargeable < period.periodEnd ? lastChargeable : period.periodEnd
  let days = 0
  for (
    let day = first;
    dayNumber(day) <= dayNumber(last);
    day = addDays(day, 1)
  ) {
    if (!pauses.some((pause) => isPausedOn(pause, day))) days += 1
  }
  return days
}

/** What one campaign costs in `period`, in whole pesos. */
export function adFeeForPeriod(
  campaign: BillableCampaign,
  pauses: readonly AdPauseSpan[],
  period: DatePeriod,
): number {
  if (!isAdBilled(campaign.status)) return 0
  return campaign.daily_price * adBillableDays(campaign, pauses, period)
}

/** One store's advertising fee for the period, as `summarizePayouts` takes it. */
export interface AdsFeeInput {
  store_id: string
  ads_fee: number
}

/**
 * Per-store fees for `period`: `round(sum(daily_price * billable days))`,
 * like the `ads_fees` CTE of `generate_payouts`. Stores with nothing to pay
 * are left out.
 */
export function adsFeesByStore(
  campaigns: readonly (BillableCampaign & { id: string; store_id: string })[],
  pausesByCampaign: ReadonlyMap<string, readonly AdPauseSpan[]>,
  period: DatePeriod,
): AdsFeeInput[] {
  const totals = new Map<string, number>()
  for (const campaign of campaigns) {
    const fee = adFeeForPeriod(
      campaign,
      pausesByCampaign.get(campaign.id) ?? [],
      period,
    )
    totals.set(campaign.store_id, (totals.get(campaign.store_id) ?? 0) + fee)
  }
  return [...totals.entries()]
    .map(([store_id, total]) => ({ store_id, ads_fee: Math.round(total) }))
    .filter((row) => row.ads_fee > 0)
    .sort((a, b) => a.store_id.localeCompare(b.store_id))
}

/**
 * Whether a campaign is on the air on `today` (Bogotá): approved, not paused
 * and inside its dates. The store must also be active; the callers check
 * that against the store row. MIRRORED IN SQL (`AD_RUNNING_RULE`).
 */
export function isAdRunning(
  campaign: Pick<BillableCampaign, 'status' | 'starts_on' | 'ends_on'>,
  today: string,
): boolean {
  return (
    campaign.status === 'active' &&
    campaign.starts_on <= today &&
    campaign.ends_on >= today
  )
}

/** The status a person reads: an approved campaign is scheduled, on the air or over. */
export function adDisplayStatus(
  campaign: Pick<BillableCampaign, 'status' | 'starts_on' | 'ends_on'>,
  today: string,
): AdDisplayStatus {
  if (campaign.status === 'active') {
    if (today < campaign.starts_on) return 'scheduled'
    if (today > campaign.ends_on) return 'finished'
    return 'active'
  }
  if (campaign.status === 'paused' && today > campaign.ends_on) {
    return 'finished'
  }
  return campaign.status
}

/**
 * What the merchant has been charged so far (or will be, once the period is
 * settled): every chargeable day up to `today`.
 */
export function adChargedToDate(
  campaign: BillableCampaign,
  pauses: readonly AdPauseSpan[],
  today: string,
): number {
  return adFeeForPeriod(campaign, pauses, {
    periodStart: campaign.starts_on,
    periodEnd: today,
  })
}
