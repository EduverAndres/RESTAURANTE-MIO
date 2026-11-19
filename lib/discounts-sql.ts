// MIRRORS `clampDiscounts` (lib/discounts.ts) INTO SQL, with the same
// discipline as lib/payouts/sql.ts: the string below is embedded verbatim in
// `compute_order_totals` (migration 20261105000300) between `codegen:`
// markers, and `matches` reads the way the SQL does so the drift test can
// compare it with the real rule. Pure.

/** Postgres `round(numeric)`: halves go away from zero. */
function roundHalfAway(value: number): number {
  return Math.sign(value) * Math.round(Math.abs(value))
}

export const DISCOUNT_CLAMP_RULE = {
  sql: [
    'v_md := least(greatest(round(coalesce(new.merchant_discount, 0)), 0), greatest(round(coalesce(new.subtotal, 0)), 0));',
    '  v_pd := least(greatest(round(coalesce(new.platform_discount, 0)), 0), greatest(round(coalesce(new.subtotal, 0)), 0) - v_md);',
  ].join('\n'),
  matches: (
    subtotal: number,
    merchantDiscount: number,
    platformDiscount: number,
  ): { merchantDiscount: number; platformDiscount: number } => {
    const base = Math.max(roundHalfAway(subtotal), 0)
    const md = Math.min(Math.max(roundHalfAway(merchantDiscount), 0), base)
    const pd = Math.min(Math.max(roundHalfAway(platformDiscount), 0), base - md)
    return { merchantDiscount: md, platformDiscount: pd }
  },
}

export function discountSqlBlocks(): Record<string, string> {
  return { discount_clamp: DISCOUNT_CLAMP_RULE.sql }
}
