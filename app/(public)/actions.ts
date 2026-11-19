'use server'

import { revalidatePath } from 'next/cache'
import { isClaimResult, type ClaimResult } from '@/lib/referrals'
import { createClient } from '@/lib/supabase/server'

export type FavoriteResult =
  | { ok: true; favorite: boolean }
  | { ok: false; error: 'unauthenticated' | 'failed' }

export async function toggleFavorite(storeId: string): Promise<FavoriteResult> {
  const supabase = await createClient()
  const {
    data: { user },
  } = await supabase.auth.getUser()
  if (!user) return { ok: false, error: 'unauthenticated' }

  const { data: existing } = await supabase
    .from('favorites')
    .select('store_id')
    .eq('user_id', user.id)
    .eq('store_id', storeId)
    .maybeSingle()

  const mutation = existing
    ? supabase
        .from('favorites')
        .delete()
        .eq('user_id', user.id)
        .eq('store_id', storeId)
    : supabase.from('favorites').insert({ user_id: user.id, store_id: storeId })

  const { error } = await mutation
  if (error) {
    console.error('Failed to toggle favorite', error)
    return { ok: false, error: 'failed' }
  }

  revalidatePath('/')
  revalidatePath('/account')
  return { ok: true, favorite: !existing }
}

/**
 * Claims an invitation for the signed-in customer. Every rule (a real code,
 * not your own, a new customer, the month's budget) is decided inside the
 * `claim_referral` database function, in one transaction.
 */
export async function claimReferral(
  code: string,
): Promise<{ result: ClaimResult; amount: number }> {
  const supabase = await createClient()
  const {
    data: { user },
  } = await supabase.auth.getUser()
  if (!user) return { result: 'unauthenticated', amount: 0 }

  const [{ data, error }, { data: settings }] = await Promise.all([
    supabase.rpc('claim_referral', { p_code: code }),
    supabase.from('platform_settings').select('referral_amount').maybeSingle(),
  ])
  if (error) {
    console.error('claim_referral failed', error)
    return { result: 'failed', amount: 0 }
  }
  const result = isClaimResult(data) ? data : 'failed'
  if (result === 'ok') revalidatePath('/account')
  return { result, amount: Number(settings?.referral_amount ?? 0) }
}

export interface DishReview {
  id: string
  /** First name only (Ley 1581); null when the profile had no name. */
  authorFirstName: string | null
  rating: number
  comment: string
  createdAt: string
}

const DISH_REVIEWS_LIMIT = 5

/**
 * The latest visible comments on a dish, loaded only when its detail opens
 * (never with the menu, so the menu stays one query). Public: the columns the
 * API can read are limited by the database to the first name, the rating, the
 * comment and the date, and hidden reviews are filtered by RLS.
 */
export async function getDishReviews(productId: string): Promise<DishReview[]> {
  if (!/^[0-9a-f-]{36}$/i.test(productId)) return []
  const supabase = await createClient()
  const { data, error } = await supabase
    .from('product_reviews')
    .select('id, author_first_name, rating, comment, created_at')
    .eq('product_id', productId)
    .not('comment', 'is', null)
    .order('created_at', { ascending: false })
    .limit(DISH_REVIEWS_LIMIT)
  if (error) {
    console.error('Failed to load dish reviews', error)
    return []
  }
  return (data ?? []).map((row) => ({
    id: row.id,
    authorFirstName: row.author_first_name,
    rating: row.rating,
    comment: row.comment ?? '',
    createdAt: row.created_at,
  }))
}
