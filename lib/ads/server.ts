import 'server-only'

import type { SupabaseClient } from '@supabase/supabase-js'
import type { Sponsorship } from '@/lib/ads/placement'
import type { AdPlacement } from '@/lib/ads/vocabulary'
import { logger } from '@/lib/log/logger'
import type { StoreStatus } from '@/types/app'
import type { Database } from '@/types/database'

// Server reads and writes for paid placements that more than one page needs.
// The decisions live in the pure modules next to this one.

/**
 * The campaigns on the air for `placement`, in today's rotation. Read with
 * the visitor's client: `sponsored_stores` is a security definer function
 * granted to anon. Any failure, including a database without the ads
 * migration yet, means nothing is sponsored; the page never breaks for it.
 */
export async function fetchSponsorships(
  supabase: SupabaseClient<Database>,
  placement: AdPlacement,
): Promise<Sponsorship[]> {
  try {
    const { data, error } = await supabase.rpc('sponsored_stores', {
      p_placement: placement,
    })
    if (error || !data) {
      if (error) logger.warn('ads.sponsored_failed', { placement }, error)
      return []
    }
    return data.map((row) => ({
      campaignId: row.campaign_id,
      storeId: row.store_id,
      slug: row.slug,
      name: row.name,
      category: row.category ?? null,
    }))
  } catch (error) {
    logger.warn('ads.sponsored_failed', { placement }, error)
    return []
  }
}

/**
 * Keeps a store's campaigns in step with the store: suspending it pauses
 * every campaign on the air (paused days are not charged), and reactivating
 * it resumes the ones the suspension paused. Campaigns an admin paused by
 * hand stay paused. Best effort: the store change already happened, so a
 * failure is logged for an admin to fix from /admin/publicidad.
 */
export async function syncStoreCampaigns(
  admin: SupabaseClient<Database>,
  storeId: string,
  status: StoreStatus,
): Promise<void> {
  const update =
    status === 'active'
      ? admin
          .from('ad_campaigns')
          .update({ status: 'active' })
          .eq('store_id', storeId)
          .eq('status', 'paused')
          .eq('pause_reason', 'store_suspended')
      : admin
          .from('ad_campaigns')
          .update({ status: 'paused', pause_reason: 'store_suspended' })
          .eq('store_id', storeId)
          .eq('status', 'active')
  const { error } = await update
  if (error) {
    logger.error('ads.store_sync_failed', { storeId, status }, error)
  }
}
