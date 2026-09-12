'use server'

import { cookies } from 'next/headers'
import { ACTIVE_STORE_COOKIE, isUuid } from '@/lib/dashboard/active-store'
import { createClient } from '@/lib/supabase/server'

export type SetActiveStoreResult = { ok: true } | { ok: false; error: string }

const ONE_YEAR_SECONDS = 60 * 60 * 24 * 365

/**
 * Persists the store the dashboard should operate on. Ownership is checked
 * through RLS: a store the user does not own simply returns zero rows.
 */
export async function setActiveStore(
  storeId: string,
): Promise<SetActiveStoreResult> {
  if (!isUuid(storeId)) return { ok: false, error: 'Tienda inválida.' }

  const supabase = await createClient()
  const {
    data: { user },
  } = await supabase.auth.getUser()
  if (!user)
    return { ok: false, error: 'Tu sesión expiró. Inicia sesión de nuevo.' }

  const { data } = await supabase
    .from('stores')
    .select('id')
    .eq('id', storeId)
    .eq('owner_id', user.id)
    .maybeSingle()
  if (!data) return { ok: false, error: 'No encontramos esa tienda.' }

  const cookieStore = await cookies()
  cookieStore.set(ACTIVE_STORE_COOKIE, storeId, {
    path: '/',
    httpOnly: true,
    sameSite: 'lax',
    secure: process.env.NODE_ENV === 'production',
    maxAge: ONE_YEAR_SECONDS,
  })
  return { ok: true }
}
