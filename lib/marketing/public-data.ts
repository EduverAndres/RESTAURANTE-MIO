import 'server-only'

import type { AdPlacementSettings } from '@/lib/ads/pricing'
import { AD_PLACEMENTS, isAdPlacement } from '@/lib/ads/vocabulary'
import { createClient } from '@/lib/supabase/server'

/**
 * Small public reads for the marketing pages. Each one degrades to "nothing"
 * instead of throwing: a landing page that loses a figure is fine, a landing
 * page that 500s is not.
 */

/** Delivery fees of the stores that are live now, as stored. */
export async function fetchActiveDeliveryFees(): Promise<number[]> {
  try {
    const supabase = await createClient()
    const { data, error } = await supabase
      .from('stores')
      .select('delivery_fee')
      .eq('status', 'active')
    if (error || !data) return []
    return data.map((store) => Number(store.delivery_fee))
  } catch {
    return []
  }
}

/**
 * A real storefront to show an owner: the active store with the most
 * reviews. `null` when there is none, and the page then hides the link
 * rather than pointing at a store that only exists in a seed file.
 */
export async function fetchDemoStoreSlug(): Promise<string | null> {
  try {
    const supabase = await createClient()
    const { data, error } = await supabase
      .from('stores')
      .select('slug')
      .eq('status', 'active')
      .order('rating_count', { ascending: false })
      .order('rating_avg', { ascending: false })
      .limit(1)
      .maybeSingle()
    if (error || !data) return null
    return data.slug
  } catch {
    return null
  }
}

/**
 * The sponsored placements on sale now, with their real price per day, in
 * the order of AD_PLACEMENTS. Empty on any failure: the page then describes
 * the product without quoting a price it cannot read, rather than quoting a
 * stale one (Ley 1480).
 */
export async function fetchAdPlacements(): Promise<AdPlacementSettings[]> {
  try {
    const supabase = await createClient()
    const { data, error } = await supabase
      .from('ad_placements')
      .select('*')
      .eq('active', true)
    if (error || !data) return []
    return data
      .filter((row) => isAdPlacement(row.placement))
      .map((row) => ({
        placement: row.placement as AdPlacementSettings['placement'],
        daily_price: Number(row.daily_price),
        max_slots: row.max_slots,
        min_days: row.min_days,
        max_days: row.max_days,
        active: row.active,
      }))
      .sort(
        (a, b) =>
          AD_PLACEMENTS.indexOf(a.placement) -
          AD_PLACEMENTS.indexOf(b.placement),
      )
  } catch {
    return []
  }
}
