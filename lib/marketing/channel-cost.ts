/**
 * What a restaurant pays a marketplace versus what it pays for its own
 * channel.
 *
 * The whole sales argument is one number, and the number has to be the
 * merchant's own: they type the commission they are actually charged rather
 * than being told what someone else charges. A figure they recognise is worth
 * more than a figure they have to take on faith — and it keeps the page from
 * making claims about a competitor's pricing that nobody here can verify.
 *
 * The comparison is deliberately allowed to come out negative. A flat
 * subscription costs more than a percentage below the break even, and a
 * calculator that hides that is one nobody believes the second time they use
 * it. `breakEvenRevenue` names the point exactly, so a small restaurant gets
 * an honest "not yet" instead of a sales pitch.
 *
 * Pure, in whole Colombian pesos, no `process.env` — so it runs identically in
 * the browser, on the server and in tests.
 */

export interface ChannelCostInput {
  /** Monthly revenue sold through the marketplace, in COP. */
  monthlyRevenue: number
  /** Commission the marketplace charges, as a percentage of revenue. */
  commissionPct: number
  /** Our flat monthly subscription, in COP. */
  subscription: number
}

export interface ChannelCost {
  /** What the marketplace takes this month. */
  marketplaceCost: number
  /** What we take this month. */
  ourCost: number
  /** Positive when switching saves money, negative when it costs more. */
  monthlySaving: number
  yearlySaving: number
  /**
   * Revenue at which both channels cost the same. Depends only on the
   * commission and the subscription, never on the revenue typed in.
   */
  breakEvenRevenue: number
  /** True only when there is a real saving; breaking even is not a reason. */
  worthIt: boolean
}

/**
 * Returned as `breakEvenRevenue` when no commission is charged: with a 0%
 * marketplace there is no revenue at which a flat fee wins, so there is no
 * number to show. A sentinel rather than `Infinity`, which formats badly and
 * serialises to `null` through JSON.
 */
export const BREAK_EVEN_UNREACHABLE = -1

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
  const subscription = money(input.subscription)

  const marketplaceCost = Math.round((revenue * rate) / 100)
  const monthlySaving = marketplaceCost - subscription

  const breakEvenRevenue =
    rate === 0
      ? BREAK_EVEN_UNREACHABLE
      : Math.ceil((subscription * 100) / rate)

  return {
    marketplaceCost,
    ourCost: subscription,
    monthlySaving,
    yearlySaving: monthlySaving * 12,
    breakEvenRevenue,
    worthIt: monthlySaving > 0,
  }
}
