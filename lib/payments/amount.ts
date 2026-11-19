// Did the gateway charge what the order costs? Pure, in whole cents, so a
// float total such as 49000.1 compares the way the gateway rounds it.
//
// A payment is only ever applied as `paid` when this holds. The Wompi webhook
// always checked it; the return-page reconciliation and the Mercado Pago
// webhook did not, so a payment for a smaller amount could mark a bigger
// order as paid. An unknown amount fails closed.

/** Order total (COP, as stored) to the integer cents a gateway reports. */
export function toCents(amount: number): number {
  return Math.round(amount * 100)
}

export function paidAmountMatches(
  orderTotal: number | string | null | undefined,
  paidCents: number | null | undefined,
): boolean {
  const total = Number(orderTotal)
  if (!Number.isFinite(total) || total < 0) return false
  if (typeof paidCents !== 'number' || !Number.isFinite(paidCents)) return false
  return Math.round(paidCents) === toCents(total)
}
