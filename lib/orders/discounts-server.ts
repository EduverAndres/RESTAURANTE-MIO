import 'server-only'

import type { SupabaseClient } from '@supabase/supabase-js'
import {
  clampDiscounts,
  couponDiscount,
  creditDiscount,
  loyaltyStatus,
  normalizeCouponCode,
  rewardDiscount,
  type CouponRule,
  type CouponUsage,
  type LoyaltyStatus,
} from '@/lib/discounts'
import { bogotaDate } from '@/lib/plans'
import type { Database } from '@/types/database'

type Client = SupabaseClient<Database>

export interface StoreCoupon extends CouponRule {
  id: string
  code: string
}

/** A store coupon by code. Read with the service role: codes are not public. */
export async function loadCoupon(
  admin: Client,
  storeId: string,
  rawCode: string,
): Promise<StoreCoupon | null> {
  const code = normalizeCouponCode(rawCode)
  if (code.length < 3) return null
  const { data } = await admin
    .from('coupons')
    .select(
      'id, code, kind, value, min_order, starts_at, ends_at, max_uses, active',
    )
    .eq('store_id', storeId)
    .eq('code', code)
    .maybeSingle()
  if (!data || (data.kind !== 'percent' && data.kind !== 'fixed')) return null
  return {
    ...data,
    kind: data.kind,
    value: Number(data.value),
    min_order: Number(data.min_order),
  }
}

/** Uses of a coupon by orders that were not cancelled. */
export async function couponUsage(
  admin: Client,
  couponId: string,
  userId: string,
): Promise<CouponUsage> {
  const [total, mine] = await Promise.all([
    admin
      .from('orders')
      .select('id', { count: 'exact', head: true })
      .eq('coupon_id', couponId)
      .neq('status', 'cancelled'),
    admin
      .from('orders')
      .select('id', { count: 'exact', head: true })
      .eq('coupon_id', couponId)
      .eq('customer_id', userId)
      .neq('status', 'cancelled'),
  ])
  return { total: total.count ?? 0, byCustomer: mine.count ?? 0 }
}

export interface LoyaltyCard extends LoyaltyStatus {
  required: number
  rewardLabel: string
  rewardValue: number
  minOrder: number
}

/**
 * The customer's stamp card at one store, or null when the store has no
 * active programme. Counted from the customer's own orders under their RLS:
 * a stamp is a delivered order of at least `min_order` after the store's own
 * discount; a reward is spent by an order flagged `loyalty_redeemed` that
 * was not cancelled.
 */
export async function loyaltyCard(
  supabase: Client,
  storeId: string,
  userId: string,
): Promise<LoyaltyCard | null> {
  const { data: program } = await supabase
    .from('loyalty_programs')
    .select('enabled, stamps_required, min_order, reward_label, reward_value')
    .eq('store_id', storeId)
    .maybeSingle()
  if (!program?.enabled || Number(program.reward_value) <= 0) return null

  const { data: orders } = await supabase
    .from('orders')
    .select('status, subtotal, merchant_discount, loyalty_redeemed')
    .eq('store_id', storeId)
    .eq('customer_id', userId)
    .limit(1000)
  const minOrder = Number(program.min_order)
  const rows = orders ?? []
  const earned = rows.filter(
    (order) =>
      order.status === 'delivered' &&
      Number(order.subtotal) - Number(order.merchant_discount) >= minOrder,
  ).length
  const redeemed = rows.filter(
    (order) => order.loyalty_redeemed && order.status !== 'cancelled',
  ).length

  return {
    ...loyaltyStatus(earned, redeemed, program.stamps_required),
    required: program.stamps_required,
    rewardLabel: program.reward_label,
    rewardValue: Number(program.reward_value),
    minOrder,
  }
}

export interface AvailableCredit {
  id: string
  amount: number
  min_order: number
  expires_at: string
}

/** The customer's unused credits that have not expired, soonest first. */
export async function openCredits(
  supabase: Client,
  userId: string,
): Promise<AvailableCredit[]> {
  const { data } = await supabase
    .from('customer_credits')
    .select('id, amount, min_order, expires_at')
    .eq('user_id', userId)
    .is('used_order_id', null)
    .gt('expires_at', new Date().toISOString())
    .order('expires_at', { ascending: true })
  return (data ?? []).map((credit) => ({
    ...credit,
    amount: Number(credit.amount),
    min_order: Number(credit.min_order),
  }))
}

export interface DiscountRequest {
  storeId: string
  userId: string
  subtotal: number
  couponCode: string
  useReward: boolean
}

export type ResolvedDiscounts =
  | {
      ok: true
      merchantDiscount: number
      platformDiscount: number
      couponId: string | null
      loyaltyRedeemed: boolean
      creditId: string | null
    }
  | { ok: false; error: string; field: string }

/**
 * Every discount an order is entitled to, re-derived on the server. One store
 * discount per order (a coupon or a loyalty reward, not both) plus, on top,
 * the customer's oldest usable referral credit, which Cerquita pays.
 */
export async function resolveDiscounts(
  supabase: Client,
  admin: Client,
  request: DiscountRequest,
): Promise<ResolvedDiscounts> {
  const code = normalizeCouponCode(request.couponCode)
  if (code && request.useReward) {
    return {
      ok: false,
      error:
        'Usa el cupón o el premio de sellos, no los dos en el mismo pedido.',
      field: 'coupon',
    }
  }

  let merchantDiscount = 0
  let couponId: string | null = null
  let loyaltyRedeemed = false

  if (code) {
    const coupon = await loadCoupon(admin, request.storeId, code)
    if (!coupon) {
      return {
        ok: false,
        error: 'Ese cupón no existe en este negocio.',
        field: 'coupon',
      }
    }
    const usage = await couponUsage(admin, coupon.id, request.userId)
    const check = couponDiscount(
      coupon,
      request.subtotal,
      bogotaDate(new Date()),
      usage,
    )
    if (!check.ok) return { ok: false, error: check.error, field: 'coupon' }
    merchantDiscount = check.amount
    couponId = coupon.id
  } else if (request.useReward) {
    const card = await loyaltyCard(supabase, request.storeId, request.userId)
    if (!card || card.available < 1) {
      return {
        ok: false,
        error: 'Todavía no tienes un premio en este negocio.',
        field: 'reward',
      }
    }
    merchantDiscount = rewardDiscount(card.rewardValue, request.subtotal)
    loyaltyRedeemed = true
  }

  let platformDiscount = 0
  let creditId: string | null = null
  for (const credit of await openCredits(supabase, request.userId)) {
    const value = creditDiscount(credit, request.subtotal - merchantDiscount)
    if (value > 0) {
      platformDiscount = value
      creditId = credit.id
      break
    }
  }

  const clamped = clampDiscounts(
    request.subtotal,
    merchantDiscount,
    platformDiscount,
  )
  return {
    ok: true,
    ...clamped,
    couponId,
    loyaltyRedeemed,
    creditId: clamped.platformDiscount > 0 ? creditId : null,
  }
}
