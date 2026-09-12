'use server'

import { revalidatePath } from 'next/cache'
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
