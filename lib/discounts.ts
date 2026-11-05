// What a discount is worth and whether it applies. Pure: the checkout action
// loads the rows, this decides. Amounts are whole Colombian pesos.
//
// Two kinds of discount exist and they are paid by different people:
//   * merchant discounts (a coupon the store created, a loyalty reward):
//     they lower the store's sale, and the commission is charged on what
//     the customer really pays;
//   * the platform discount (a referral credit): Cerquita pays it, so the
//     store is settled on its full sale.
// `clampDiscounts` is MIRRORED IN SQL inside `compute_order_totals`.

export type CouponKind = 'percent' | 'fixed'

export interface CouponRule {
  kind: CouponKind
  value: number
  min_order: number
  /** Inclusive, date-only, Bogotá; null = no limit. */
  starts_at: string | null
  ends_at: string | null
  /** Null = unlimited. */
  max_uses: number | null
  active: boolean
}

export interface CouponUsage {
  /** Non-cancelled orders that used the coupon. */
  total: number
  /** Of those, the ones placed by this customer. */
  byCustomer: number
}

export type DiscountCheck =
  { ok: true; amount: number } | { ok: false; error: string }

/** Codes are typed by hand: case and spaces must not make one fail. */
export function normalizeCouponCode(raw: string): string {
  return raw.toUpperCase().replace(/[^A-Z0-9]/g, '')
}

function whole(value: number): number {
  return Number.isFinite(value) ? Math.max(0, Math.round(value)) : 0
}

/**
 * The value of a store coupon on `subtotal`, or why it does not apply.
 * One use per customer: a coupon is a reason to come back once, not a
 * permanent price cut.
 */
export function couponDiscount(
  coupon: CouponRule,
  subtotal: number,
  today: string,
  usage: CouponUsage,
): DiscountCheck {
  if (!coupon.active) return { ok: false, error: 'Este cupón no está activo.' }
  if (coupon.starts_at && today < coupon.starts_at)
    return { ok: false, error: 'Este cupón todavía no se puede usar.' }
  if (coupon.ends_at && today > coupon.ends_at)
    return { ok: false, error: 'Este cupón ya venció.' }
  if (subtotal < Number(coupon.min_order))
    return {
      ok: false,
      error: `Este cupón aplica desde un pedido mínimo de $${whole(Number(coupon.min_order)).toLocaleString('es-CO')}.`,
    }
  if (coupon.max_uses !== null && usage.total >= coupon.max_uses)
    return { ok: false, error: 'Este cupón se agotó.' }
  if (usage.byCustomer > 0) return { ok: false, error: 'Ya usaste este cupón.' }

  const raw =
    coupon.kind === 'percent'
      ? (subtotal * Math.min(100, Number(coupon.value))) / 100
      : Number(coupon.value)
  return { ok: true, amount: Math.min(whole(raw), whole(subtotal)) }
}

export interface LoyaltyStatus {
  /** Stamps on the card in progress. */
  stamps: number
  /** Completed cards not yet redeemed. */
  available: number
}

/**
 * The customer's card at one store, from two counts: qualifying delivered
 * orders (`earned`) and rewards already used (`redeemed`).
 */
export function loyaltyStatus(
  earned: number,
  redeemed: number,
  required: number,
): LoyaltyStatus {
  const size = Math.max(1, Math.round(required))
  const completed = Math.floor(Math.max(0, earned) / size)
  return {
    stamps: Math.max(0, earned) % size,
    available: Math.max(0, completed - Math.max(0, redeemed)),
  }
}

/** A loyalty reward is worth up to its value, never more than the order. */
export function rewardDiscount(rewardValue: number, subtotal: number): number {
  return Math.min(whole(rewardValue), whole(subtotal))
}

export interface CreditRule {
  amount: number
  min_order: number
  expires_at: string
}

/** A referral credit's value on this order, 0 when it does not apply. */
export function creditDiscount(
  credit: CreditRule,
  subtotal: number,
  now: Date = new Date(),
): number {
  if (new Date(credit.expires_at).getTime() <= now.getTime()) return 0
  if (subtotal < Number(credit.min_order)) return 0
  return Math.min(whole(Number(credit.amount)), whole(subtotal))
}

/**
 * Both discounts kept inside the subtotal, the merchant's first. MIRRORED IN
 * SQL (`compute_order_totals`), which applies the same limits to whatever
 * was written, so a total can never go below delivery fee plus tip.
 */
export function clampDiscounts(
  subtotal: number,
  merchantDiscount: number,
  platformDiscount: number,
): { merchantDiscount: number; platformDiscount: number } {
  const base = whole(subtotal)
  const merchant = Math.min(whole(merchantDiscount), base)
  const platform = Math.min(whole(platformDiscount), base - merchant)
  return { merchantDiscount: merchant, platformDiscount: platform }
}
