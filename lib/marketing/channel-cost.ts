/**
 * What a business pays its current delivery app versus what it would pay on
 * Cerquita for the same sales.
 *
 * The whole sales argument is one number, and the number has to be the
 * merchant's own: they type the commission they are actually charged rather
 * than being told what someone else charges. A figure they recognise is worth
 * more than a figure they have to take on faith — and it keeps the page from
 * making claims about a competitor's pricing that nobody here can verify.
 *
 * Our side is the real plan rule (lib/plans.ts): the base commission on every
 * delivery and pickup, plus the online-payment share on the part paid online,
 * plus the plan's monthly fee. Table orders carry no commission, but they are
 * not what a delivery app sells, so they are left out of the comparison
 * rather than used to flatter it.
 *
 * The comparison is allowed to come out negative: a calculator that hides
 * the case where the current app is cheaper is one nobody believes the
 * second time they use it.
 *
 * Pure, in whole Colombian pesos, no `process.env` — so it runs identically in
 * the browser, on the server and in tests.
 */

export interface ChannelCostInput {
  /** Monthly revenue sold through the current app, in COP. */
  monthlyRevenue: number
  /** Commission the current app charges, as a percentage of revenue. */
  commissionPct: number
  /** Share of those sales paid online (card, PSE, Nequi), 0–100. */
  onlineSharePct: number
  /** Our base commission on delivery and pickup. */
  ourCommissionPct: number
  /** Our extra percentage on what is paid online. */
  ourOnlinePct: number
  /** The plan's monthly fee, in COP (0 on Normal). */
  ourMonthlyFee: number
}

export interface ChannelCost {
  /** What the current app takes this month. */
  marketplaceCost: number
  /** What we take this month, plan fee included. */
  ourCost: number
  /** Our commission as one average percentage, for the copy. */
  ourEffectivePct: number
  /** Positive when switching saves money, negative when it costs more. */
  monthlySaving: number
  yearlySaving: number
  /** True only when there is a real saving; breaking even is not a reason. */
  worthIt: boolean
}

/** Finite, non-negative, whole pesos. Anything else becomes 0. */
function money(value: number): number {
  return Number.isFinite(value) ? Math.max(0, Math.round(value)) : 0
}

/** Finite percentage clamped to 0–100; a rate outside that is a typo. */
function percentage(value: number): number {
  if (!Number.isFinite(value)) return 0
  return Math.min(100, Math.max(0, value))
}

export function compareChannelCost(input: ChannelCostInput): ChannelCost {
  const revenue = money(input.monthlyRevenue)
  const rate = percentage(input.commissionPct)
  const onlineShare = percentage(input.onlineSharePct)

  const ourEffectivePct =
    Math.round(
      (percentage(input.ourCommissionPct) +
        (percentage(input.ourOnlinePct) * onlineShare) / 100) *
        100,
    ) / 100

  const marketplaceCost = Math.round((revenue * rate) / 100)
  const ourCost =
    Math.round((revenue * ourEffectivePct) / 100) + money(input.ourMonthlyFee)
  const monthlySaving = marketplaceCost - ourCost

  return {
    marketplaceCost,
    ourCost,
    ourEffectivePct,
    monthlySaving,
    yearlySaving: monthlySaving * 12,
    worthIt: monthlySaving > 0,
  }
}
