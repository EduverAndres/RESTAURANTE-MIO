'use server'

import { revalidatePath } from 'next/cache'
import { isUuid } from '@/lib/dashboard/active-store'
import { createClient } from '@/lib/supabase/server'
import {
  couponSchema,
  loyaltySchema,
  type CouponInput,
  type LoyaltyInput,
} from '@/lib/validations/loyalty'

type Result = { ok: true } | { ok: false; error: string; field?: string }

const SESSION_EXPIRED = 'Tu sesión expiró. Inicia sesión de nuevo.'
const UNIQUE_VIOLATION = '23505'

// Every write runs under the owner's RLS ("owner manages"), so a store id
// that is not theirs simply matches nothing.

export async function saveLoyaltyProgram(
  storeId: string,
  input: LoyaltyInput,
): Promise<Result> {
  if (!isUuid(storeId)) return { ok: false, error: 'Tienda inválida.' }
  const parsed = loyaltySchema.safeParse(input)
  if (!parsed.success) {
    const issue = parsed.error.issues[0]
    return {
      ok: false,
      error: issue?.message ?? 'Revisa la tarjeta de sellos.',
      field: String(issue?.path[0] ?? ''),
    }
  }

  const supabase = await createClient()
  const {
    data: { user },
  } = await supabase.auth.getUser()
  if (!user) return { ok: false, error: SESSION_EXPIRED }

  const { error } = await supabase.from('loyalty_programs').upsert({
    store_id: storeId,
    enabled: parsed.data.enabled,
    stamps_required: parsed.data.stampsRequired,
    min_order: parsed.data.minOrder,
    reward_label: parsed.data.rewardLabel,
    reward_value: parsed.data.rewardValue,
    updated_at: new Date().toISOString(),
  })
  if (error) {
    console.error('Failed to save loyalty program', error)
    return { ok: false, error: 'No pudimos guardar la tarjeta de sellos.' }
  }
  revalidatePath('/dashboard/fidelidad')
  return { ok: true }
}

export async function createCoupon(
  storeId: string,
  input: CouponInput,
): Promise<Result> {
  if (!isUuid(storeId)) return { ok: false, error: 'Tienda inválida.' }
  const parsed = couponSchema.safeParse(input)
  if (!parsed.success) {
    const issue = parsed.error.issues[0]
    return {
      ok: false,
      error: issue?.message ?? 'Revisa el cupón.',
      field: String(issue?.path[0] ?? ''),
    }
  }

  const supabase = await createClient()
  const {
    data: { user },
  } = await supabase.auth.getUser()
  if (!user) return { ok: false, error: SESSION_EXPIRED }

  const { error } = await supabase.from('coupons').insert({
    store_id: storeId,
    code: parsed.data.code,
    kind: parsed.data.kind,
    value: parsed.data.value,
    min_order: parsed.data.minOrder,
    starts_at: parsed.data.startsAt,
    ends_at: parsed.data.endsAt,
    max_uses: parsed.data.maxUses,
  })
  if (error) {
    if (error.code === UNIQUE_VIOLATION)
      return {
        ok: false,
        error: 'Ya tienes un cupón con ese código.',
        field: 'code',
      }
    console.error('Failed to create coupon', error)
    return { ok: false, error: 'No pudimos crear el cupón.' }
  }
  revalidatePath('/dashboard/fidelidad')
  return { ok: true }
}

export async function setCouponActive(
  couponId: string,
  active: boolean,
): Promise<Result> {
  if (!isUuid(couponId)) return { ok: false, error: 'Cupón inválido.' }
  const supabase = await createClient()
  const {
    data: { user },
  } = await supabase.auth.getUser()
  if (!user) return { ok: false, error: SESSION_EXPIRED }

  const { data, error } = await supabase
    .from('coupons')
    .update({ active })
    .eq('id', couponId)
    .select('id')
  if (error || !data || data.length === 0) {
    return { ok: false, error: 'No pudimos actualizar el cupón.' }
  }
  revalidatePath('/dashboard/fidelidad')
  return { ok: true }
}
