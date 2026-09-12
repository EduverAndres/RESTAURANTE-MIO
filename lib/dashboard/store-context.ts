import 'server-only'

import { cookies } from 'next/headers'
import { redirect } from 'next/navigation'
import { cache } from 'react'
import { requireRole } from '@/lib/auth'
import {
  ACTIVE_STORE_COOKIE,
  parseActiveStoreId,
  pickActiveStore,
} from '@/lib/dashboard/active-store'
import { createClient } from '@/lib/supabase/server'
import type { Store } from '@/types/app'

/** Lightweight shape shared with the StoreSwitcher in the dashboard header. */
export type MerchantStoreSummary = Pick<
  Store,
  'id' | 'name' | 'slug' | 'status' | 'is_open'
>

/** Stores owned by the user, oldest first. Memoised per request. */
export const getMerchantStores = cache(
  async (userId: string): Promise<MerchantStoreSummary[]> => {
    const supabase = await createClient()
    const { data } = await supabase
      .from('stores')
      .select('id, name, slug, status, is_open')
      .eq('owner_id', userId)
      .order('created_at', { ascending: true })
    return data ?? []
  },
)

export interface ActiveStoreContext {
  userId: string
  stores: MerchantStoreSummary[]
  active: MerchantStoreSummary
}

/**
 * Resolves the store the dashboard operates on. Owners without any store are
 * sent to the onboarding wizard; a stale cookie falls back to the first store.
 */
export async function requireActiveStore(
  next = '/dashboard',
): Promise<ActiveStoreContext> {
  const { user } = await requireRole(['merchant', 'admin'], next)
  const stores = await getMerchantStores(user.id)
  if (stores.length === 0) redirect('/dashboard/onboarding')

  const cookieStore = await cookies()
  const requested = parseActiveStoreId(
    cookieStore.get(ACTIVE_STORE_COOKIE)?.value,
  )
  const active = pickActiveStore(stores, requested)
  if (!active) redirect('/dashboard/onboarding')

  return { userId: user.id, stores, active }
}

/** Full row of the active store, for pages that edit it. */
export async function requireActiveStoreRow(
  next = '/dashboard',
): Promise<ActiveStoreContext & { store: Store }> {
  const context = await requireActiveStore(next)
  const supabase = await createClient()
  const { data } = await supabase
    .from('stores')
    .select('*')
    .eq('id', context.active.id)
    .maybeSingle()
  if (!data) redirect('/dashboard/onboarding')
  return { ...context, store: data }
}
