/**
 * The badges that make a store card worth a second look, derived only from
 * what the store row already says. No badge is ever granted by hand: a store
 * is "popular" because enough people rated it well, "fast" because its own
 * estimate says so, and "new" because nobody has rated it yet — which also
 * spares a brand-new shop the "0,0 (0)" that reads as a bad review.
 */

/** Minutes at or under which an open store counts as fast delivery. */
export const FAST_ETA_MIN = 25
/** Ratings needed before an average means anything to a stranger. */
export const POPULAR_MIN_RATINGS = 20
export const POPULAR_MIN_AVERAGE = 4.5

export type StoreHighlight = 'popular' | 'fast' | 'free-delivery' | 'new'

export interface HighlightInput {
  is_open: boolean
  rating_avg: number | null
  rating_count: number | null
  delivery_fee: number | null
  prep_time_min: number | null
  eta_min?: number | null
}

export function etaOf(store: HighlightInput): number {
  return store.eta_min ?? store.prep_time_min ?? 20
}

export function isPopular(store: HighlightInput): boolean {
  return (
    (store.rating_count ?? 0) >= POPULAR_MIN_RATINGS &&
    Number(store.rating_avg ?? 0) >= POPULAR_MIN_AVERAGE
  )
}

export function isFast(store: HighlightInput): boolean {
  return store.is_open && etaOf(store) <= FAST_ETA_MIN
}

export function hasFreeDelivery(store: HighlightInput): boolean {
  return Number(store.delivery_fee ?? 0) <= 0
}

export function isNew(store: HighlightInput): boolean {
  return (store.rating_count ?? 0) === 0
}

/**
 * The one badge a card shows, strongest reason first. Free delivery is not in
 * this list: it already has its own chip on the photo.
 */
export function primaryHighlight(
  store: HighlightInput,
): Exclude<StoreHighlight, 'free-delivery'> | null {
  if (isPopular(store)) return 'popular'
  if (isFast(store)) return 'fast'
  if (isNew(store)) return 'new'
  return null
}
