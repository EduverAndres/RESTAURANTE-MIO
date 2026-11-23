import 'server-only'

import { cache } from 'react'
import { isReservable } from '@/lib/reservations/server'
import { createClient } from '@/lib/supabase/server'
import type { StoreCardData } from '@/components/store/store-card'

/**
 * Every store that takes reservations right now, for the /reservas
 * directory and the home rail. A failed read returns an empty list: the
 * directory is an extra, never a reason for the home page to break.
 */
export const fetchReservableStores = cache(
  async (): Promise<StoreCardData[]> => {
    const supabase = await createClient()
    const { data, error } = await supabase
      .from('reservation_settings')
      .select(
        'enabled, stores!inner(id, slug, name, category, cover_url, logo_url, rating_avg, rating_count, prep_time_min, delivery_fee, is_open, status, plan, founder_until, schedule)',
      )
      .eq('enabled', true)
      .eq('stores.status', 'active')
    if (error) {
      console.error('Failed to read reservable stores', error)
      return []
    }
    return (data ?? [])
      .filter((row) => row.stores && isReservable(row.stores, row))
      .map(({ stores: store }) => ({
        id: store.id,
        slug: store.slug,
        name: store.name,
        category: store.category,
        cover_url: store.cover_url,
        logo_url: store.logo_url,
        rating_avg: store.rating_avg,
        rating_count: store.rating_count,
        prep_time_min: store.prep_time_min,
        delivery_fee: store.delivery_fee,
        is_open: store.is_open,
      }))
      .sort(
        (a, b) =>
          (b.rating_count ?? 0) - (a.rating_count ?? 0) ||
          a.name.localeCompare(b.name),
      )
  },
)
