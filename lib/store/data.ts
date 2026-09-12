import 'server-only'
import { cache } from 'react'
import { createClient } from '@/lib/supabase/server'
import type { MenuCategoryWithProducts, Review, Store } from '@/types/app'

/**
 * Storefront reads, memoised per request.
 *
 * Several sections need the same rows — the menu and the featured strip both
 * need the products, the hero and the info section both need the store — so
 * every query goes through `cache()` and runs once no matter how many sections
 * a theme turns on.
 */

export const fetchStore = cache(async function fetchStore(
  slug: string,
): Promise<Store | null> {
  const supabase = await createClient()
  const { data, error } = await supabase
    .from('stores')
    .select('*')
    .eq('slug', slug)
    .eq('status', 'active')
    .maybeSingle()

  // A failed query and a missing slug both arrive as `data: null`. Callers turn
  // null into notFound(), so swallowing the error would tell a visitor the shop
  // does not exist because of a transient network blip. Throw instead and let
  // the route's error boundary offer a retry.
  if (error) {
    throw new Error(`Failed to load store "${slug}": ${error.message}`, {
      cause: error,
    })
  }
  return data ?? null
})

export const fetchMenu = cache(async function fetchMenu(
  storeId: string,
): Promise<MenuCategoryWithProducts[]> {
  const supabase = await createClient()
  const { data, error } = await supabase
    .from('menu_categories')
    .select('*, products(*, product_options(*, product_option_values(*)))')
    .eq('store_id', storeId)
    .eq('is_visible', true)
    .eq('products.is_available', true)
    .order('position', { ascending: true })
    .order('position', { referencedTable: 'products', ascending: true })

  if (error) {
    console.error('Failed to load menu', error)
    return []
  }
  return (data ?? []).filter((category) => category.products.length > 0)
})

export interface StoreReview extends Review {
  /** Null for an anonymous visitor: `profiles` is not publicly readable. */
  authorName: string | null
}

const REVIEWS_LIMIT = 12

export const fetchReviews = cache(async function fetchReviews(
  storeId: string,
): Promise<StoreReview[]> {
  const supabase = await createClient()
  const { data, error } = await supabase
    .from('reviews')
    .select('*, profiles(full_name)')
    .eq('store_id', storeId)
    .not('comment', 'is', null)
    .order('created_at', { ascending: false })
    .limit(REVIEWS_LIMIT)

  if (error) {
    console.error('Failed to load reviews', error)
    return []
  }

  return (data ?? []).map((row) => {
    const { profiles, ...review } = row as typeof row & {
      profiles: { full_name: string | null } | null
    }
    return { ...review, authorName: profiles?.full_name ?? null }
  })
})

/** Whether the signed-in visitor (if any) has this store in their favourites. */
export const fetchIsFavorite = cache(async function fetchIsFavorite(
  storeId: string,
): Promise<boolean> {
  const supabase = await createClient()
  const {
    data: { user },
  } = await supabase.auth.getUser()
  if (!user) return false
  const { data } = await supabase
    .from('favorites')
    .select('store_id')
    .eq('store_id', storeId)
    .eq('user_id', user.id)
    .maybeSingle()
  return data !== null
})
