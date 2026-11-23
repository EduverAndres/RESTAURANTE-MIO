// Where sponsored stores go in a list. Pure: the home's "Destacados" rail,
// the category grid and the search suggestions all order themselves here.
//
// Two rules hold everywhere:
//
//   * a sponsored store comes first and appears once: it is moved to the top,
//     never shown twice in the same list;
//   * it carries its campaign id, so the card links through the click
//     counter and shows the "Patrocinado" label (Ley 1480: an ad has to be
//     recognisable as one, visibly, not only to a screen reader).
import { SPONSORED_LABEL } from '@/lib/ads/vocabulary'

/** One running campaign, as `public.sponsored_stores` returns it. */
export interface Sponsorship {
  campaignId: string
  storeId: string
  slug: string
  name: string
  /** The category the campaign was bought for (meaningful for category_top). */
  category: string | null
}

/** A list item that is on the list because a campaign pays for it. */
export type SponsoredItem<T> = T & { sponsoredCampaignId: string }

/** A list item that may or may not be sponsored. */
export type MaybeSponsored<T> = T & { sponsoredCampaignId?: string }

/**
 * The sponsored stores as items of `pool`, in the campaigns' order, one per
 * store. A store missing from `pool` is skipped: the caller fetches the
 * cards of sponsored stores the visitor's list does not include, so a
 * campaign is never silently lost because of the list's limit.
 */
export function sponsoredItems<T extends { id: string }>(
  sponsorships: readonly Sponsorship[],
  pool: readonly T[],
): SponsoredItem<T>[] {
  const byId = new Map(pool.map((item) => [item.id, item]))
  const seen = new Set<string>()
  const items: SponsoredItem<T>[] = []
  for (const sponsorship of sponsorships) {
    if (seen.has(sponsorship.storeId)) continue
    const item = byId.get(sponsorship.storeId)
    if (!item) continue
    seen.add(sponsorship.storeId)
    items.push({ ...item, sponsoredCampaignId: sponsorship.campaignId })
  }
  return items
}

function prependUnique<T extends { id: string }>(
  first: readonly SponsoredItem<T>[],
  rest: readonly T[],
): MaybeSponsored<T>[] {
  const seen = new Set<string>()
  const merged: MaybeSponsored<T>[] = []
  for (const item of first) {
    if (seen.has(item.id)) continue
    seen.add(item.id)
    merged.push(item)
  }
  for (const item of rest) {
    if (seen.has(item.id)) continue
    seen.add(item.id)
    merged.push(item)
  }
  return merged
}

/**
 * The home's "Destacados": sponsored stores first, then the stores featured
 * by their plan (VIP, and founders inside their offer), without repeating a
 * store that is both. A VIP store that also pays for the slot shows once,
 * labelled as sponsored.
 */
export function mergeFeatured<T extends { id: string }>(
  sponsored: readonly SponsoredItem<T>[],
  featured: readonly T[],
): MaybeSponsored<T>[] {
  return prependUnique(sponsored, featured)
}

/** Category names compare case- and accent-insensitively. */
export function sameCategory(a: string | null, b: string | null): boolean {
  if (a === null || b === null) return false
  return normalizeSearchText(a) === normalizeSearchText(b)
}

/** The campaigns bought for `category`'s top slot. */
export function sponsorshipsForCategory(
  sponsorships: readonly Sponsorship[],
  category: string,
): Sponsorship[] {
  return sponsorships.filter((sponsorship) =>
    sameCategory(sponsorship.category, category),
  )
}

/**
 * A grid with its sponsored stores pinned to the top. `sponsored` should
 * already be narrowed to the grid's category (`sponsorshipsForCategory`).
 */
export function pinSponsored<T extends { id: string }>(
  visible: readonly T[],
  sponsored: readonly SponsoredItem<T>[],
): MaybeSponsored<T>[] {
  return prependUnique(sponsored, visible)
}

/** Lower case, no accents, trimmed: "Café" matches "cafe". */
export function normalizeSearchText(text: string): string {
  return text.normalize('NFD').replace(/[̀-ͯ]/g, '').toLowerCase().trim()
}

/** The shortest query that brings up suggestions (and sponsored ones). */
export const MIN_SEARCH_LENGTH = 2

/**
 * The search campaigns relevant to `query`: the store's name or category
 * contains it, or the store already came up in the results (one of its
 * dishes matched). A sponsored result that has nothing to do with what was
 * typed would be noise, and an honest ad is a relevant one.
 */
export function sponsorshipsForSearch(
  sponsorships: readonly Sponsorship[],
  query: string,
  matchedStoreIds: ReadonlySet<string> = new Set(),
): Sponsorship[] {
  const needle = normalizeSearchText(query)
  if (needle.length < MIN_SEARCH_LENGTH) return []
  const seen = new Set<string>()
  return sponsorships.filter((sponsorship) => {
    if (seen.has(sponsorship.storeId)) return false
    const relevant =
      matchedStoreIds.has(sponsorship.storeId) ||
      normalizeSearchText(sponsorship.name).includes(needle) ||
      (sponsorship.category !== null &&
        normalizeSearchText(sponsorship.category).includes(needle))
    if (relevant) seen.add(sponsorship.storeId)
    return relevant
  })
}

/** Where a sponsored link goes: through the click counter, which redirects. */
export function sponsoredHref(campaignId: string): string {
  return `/api/ads/click/${campaignId}`
}

/** The accessible name of a sponsored card's link. */
export function sponsoredLinkLabel(storeName: string): string {
  return `Ver ${storeName} (${SPONSORED_LABEL.toLowerCase()})`
}
