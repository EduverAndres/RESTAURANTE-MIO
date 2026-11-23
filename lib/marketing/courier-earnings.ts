/**
 * What a courier could earn, as an estimate built with their own numbers.
 *
 * The rule is the product's (docs/PRODUCTO.md): on every delivery the courier
 * keeps the delivery fee the business charges plus 100 % of the tip the
 * customer leaves. Everything else here is the courier's own assumption —
 * how many deliveries, what fee, what tip, how many days — so the page can
 * show a figure without promising one. The UI states that it is an estimate,
 * not a guaranteed income, next to the result.
 *
 * Costs (fuel, maintenance, data plan, social security contributions) are not
 * subtracted: they are the courier's, and the page says so rather than
 * guessing them.
 *
 * Pure, whole pesos and whole deliveries, no `process.env`, so it runs the same
 * in the browser, on the server and in tests.
 */

/** Share of the tip that goes to the courier: all of it. */
export const COURIER_TIP_SHARE = 1

interface Range {
  min: number
  max: number
  step: number
}

/** The sliders' bounds, shared with the calculator so the two cannot drift. */
export const COURIER_ESTIMATE_RANGES = {
  deliveriesPerDay: { min: 1, max: 30, step: 1 },
  averageFee: { min: 0, max: 20_000, step: 500 },
  averageTip: { min: 0, max: 10_000, step: 500 },
  days: { min: 1, max: 31, step: 1 },
} as const satisfies Record<string, Range>

export interface CourierEarningsInput {
  deliveriesPerDay: number
  /** Average delivery fee per order, in COP. */
  averageFee: number
  /** Average tip per order, in COP. */
  averageTip: number
  /** Days worked in the period being estimated. */
  days: number
}

/**
 * Example values the calculator starts from when there is no real average
 * fee to use. Labelled as an example on the page. The tip starts at zero: it
 * is the customer's choice and many orders carry none.
 */
export const COURIER_ESTIMATE_DEFAULTS: CourierEarningsInput = {
  deliveriesPerDay: 6,
  averageFee: 5_000,
  averageTip: 0,
  days: 20,
}

export interface CourierEarnings {
  /** Fee plus tip on one delivery. */
  perDelivery: number
  perDay: number
  /** Deliveries in the whole period. */
  deliveries: number
  fromFees: number
  fromTips: number
  total: number
}

/** Finite, non-negative, whole pesos. Anything else becomes 0. */
function money(value: number): number {
  return Number.isFinite(value) ? Math.max(0, Math.round(value)) : 0
}

/** Whole count within [0, max]; a count past the slider is a typo. */
function count(value: number, range: Range): number {
  if (!Number.isFinite(value)) return 0
  return Math.min(range.max, Math.max(0, Math.round(value)))
}

export function estimateCourierEarnings(
  input: CourierEarningsInput,
): CourierEarnings {
  const deliveriesPerDay = count(
    input.deliveriesPerDay,
    COURIER_ESTIMATE_RANGES.deliveriesPerDay,
  )
  const days = count(input.days, COURIER_ESTIMATE_RANGES.days)
  const fee = money(input.averageFee)
  const tip = money(money(input.averageTip) * COURIER_TIP_SHARE)

  const deliveries = deliveriesPerDay * days
  const fromFees = deliveries * fee
  const fromTips = deliveries * tip

  return {
    perDelivery: fee + tip,
    perDay: deliveriesPerDay * (fee + tip),
    deliveries,
    fromFees,
    fromTips,
    total: fromFees + fromTips,
  }
}

/**
 * Mean of the delivery fees that are actually charged, rounded to the
 * slider's step. Free delivery is left out: a store that delivers itself for
 * free says nothing about what a courier is paid. `null` without data.
 */
export function averageDeliveryFee(
  fees: readonly (number | null | undefined)[],
  step: number = COURIER_ESTIMATE_RANGES.averageFee.step,
): number | null {
  const charged = fees.filter(
    (fee): fee is number =>
      typeof fee === 'number' && Number.isFinite(fee) && fee > 0,
  )
  if (charged.length === 0) return null
  const mean = charged.reduce((total, fee) => total + fee, 0) / charged.length
  return Math.max(step, Math.round(mean / step) * step)
}

/** Where the calculator starts: the real average fee when there is one. */
export function defaultCourierEstimate(
  realAverageFee: number | null,
): CourierEarningsInput {
  if (realAverageFee === null) return { ...COURIER_ESTIMATE_DEFAULTS }
  const { min, max } = COURIER_ESTIMATE_RANGES.averageFee
  return {
    ...COURIER_ESTIMATE_DEFAULTS,
    averageFee: Math.min(max, Math.max(min, realAverageFee)),
  }
}
