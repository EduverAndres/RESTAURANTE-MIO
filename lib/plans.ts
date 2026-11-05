// Merchant plans and the platform's take. Pure: no React, no Supabase, safe
// on client and server.
//
// Two rules here are MIRRORED IN SQL and guarded by tests/plans-sql-drift:
//   * `platformFeePct` is what `public.compute_order_totals` charges on every
//     order (migration 20261105000100_plans_and_commission.sql);
//   * `billableDays` is how `public.generate_payouts` prorates a plan's monthly
//     fee into a payout period (migration 20261105000200_settlement.sql).
// Change one here and the drift test fails until the SQL follows.
import type { OrderType, PaymentMethod } from '@/types/app'

export const PLAN_IDS = ['normal', 'mediano', 'vip'] as const
export type PlanId = (typeof PLAN_IDS)[number]

export const PLAN_LABELS: Record<PlanId, string> = {
  normal: 'Normal',
  mediano: 'Mediano',
  vip: 'VIP',
}

/**
 * The monthly fees the migration seeds into `public.plans`. The TABLE is the
 * source of truth for prices: change them there and every screen and every
 * payout follows. These values only exist so a fresh database starts right
 * and so the pricing copy has a fallback when the table cannot be read.
 */
export const DEFAULT_PLAN_FEES: Record<PlanId, number> = {
  normal: 0,
  mediano: 49_900,
  vip: 129_900,
}

/** Commission on delivery and pickup; stores.commission_pct defaults to it. */
export const BASE_COMMISSION_PCT = 6
/** Added when the customer pays online; covers the gateway's cut. */
export const ONLINE_PAYMENT_PCT = 5
/** How long a founding business keeps VIP and 0% commission. */
export const FOUNDER_DAYS = 90
/** A plan fee is a monthly price; a period is billed per day of it. */
export const DAYS_PER_BILLED_MONTH = 30

export const PLAN_FEATURES = [
  'presets',
  'theme-editor',
  'full-metrics',
  'custom-css',
  'hero-video',
  'featured-home',
  'priority-support',
] as const
export type PlanFeature = (typeof PLAN_FEATURES)[number]

const FEATURES: Record<PlanId, ReadonlySet<PlanFeature>> = {
  normal: new Set(['presets']),
  mediano: new Set(['presets', 'theme-editor', 'full-metrics']),
  vip: new Set(PLAN_FEATURES),
}

export function planHas(plan: PlanId, feature: PlanFeature): boolean {
  return FEATURES[plan].has(feature)
}

/** The cheapest plan that includes `feature`, for "Disponible en …" copy. */
export function planFor(feature: PlanFeature): PlanId {
  return PLAN_IDS.find((plan) => planHas(plan, feature)) ?? 'vip'
}

export function isPlanId(value: unknown): value is PlanId {
  return (PLAN_IDS as readonly unknown[]).includes(value)
}

/**
 * Calendar date in Bogotá (`YYYY-MM-DD`). Colombia is UTC-5 all year, with no
 * daylight saving, so a fixed shift is exact. A founder date is a date the
 * merchant was told, so it is read on their calendar, not on UTC's.
 */
export function bogotaDate(at: Date): string {
  return new Date(at.getTime() - 5 * 60 * 60 * 1000).toISOString().slice(0, 10)
}

/** Inclusive of the last day: "fundador hasta el 3 de febrero" includes it. */
export function isFounderActive(
  founderUntil: string | null,
  at: Date = new Date(),
): boolean {
  return founderUntil !== null && bogotaDate(at) <= founderUntil
}

/** The plan whose features apply now: a founder gets VIP for free. */
export function effectivePlan(
  store: { plan: PlanId; founder_until: string | null },
  at: Date = new Date(),
): PlanId {
  return isFounderActive(store.founder_until, at) ? 'vip' : store.plan
}

export interface FeeOrder {
  type: OrderType
  payment_method: PaymentMethod
  created_at: string | Date
}

export interface FeeStore {
  commission_pct: number
  online_payment_pct: number
  founder_until: string | null
}

/**
 * Percentage of the subtotal the platform keeps on one order. MIRRORED IN
 * SQL (`compute_order_totals`).
 *
 * - The base commission is 0 on a table order, 0 while the store is a
 *   founder (dated by when the order was placed, so it never changes after
 *   the fact), and `commission_pct` otherwise.
 * - Any payment that is not cash adds `online_payment_pct`, founders
 *   included: the gateway charges the platform on every online payment, and
 *   this is what keeps that cost from turning an order into a loss.
 */
export function platformFeePct(order: FeeOrder, store: FeeStore): number {
  const free =
    order.type === 'table' ||
    isFounderActive(store.founder_until, new Date(order.created_at))
  const base = free ? 0 : store.commission_pct
  const online = order.payment_method === 'cash' ? 0 : store.online_payment_pct
  return base + online
}

export interface DatePeriod {
  /** Inclusive, date-only. */
  periodStart: string
  /** Inclusive, date-only. */
  periodEnd: string
}

function dayNumber(dateOnly: string): number {
  return Math.round(
    new Date(`${dateOnly}T00:00:00.000Z`).getTime() / 86_400_000,
  )
}

/**
 * Days of the period the plan is billed for: the days after the founder
 * period ends. MIRRORED IN SQL (`generate_payouts`).
 */
export function billableDays(
  period: DatePeriod,
  founderUntil: string | null,
): number {
  const start = dayNumber(period.periodStart)
  const end = dayNumber(period.periodEnd)
  const firstBilled =
    founderUntil === null ? start : Math.max(start, dayNumber(founderUntil) + 1)
  return Math.max(0, end - firstBilled + 1)
}

/** The plan fee one payout period carries, in whole pesos. */
export function planFeeForPeriod(
  monthlyFee: number,
  period: DatePeriod,
  founderUntil: string | null,
): number {
  return Math.round(
    (monthlyFee * billableDays(period, founderUntil)) / DAYS_PER_BILLED_MONTH,
  )
}
