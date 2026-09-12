import type { StoreHoursState } from '@/lib/store/hours'
import type { CartTable } from '@/lib/cart'
import type { Store, StoreTheme, ThemeSection } from '@/types/app'

/**
 * Everything a storefront section may need, resolved once on the server and
 * handed to every section component through the registry. A new section adds
 * one entry to the registry and reads from here — it never re-queries.
 */
export interface StorefrontContext {
  store: Store
  theme: StoreTheme
  hours: StoreHoursState
  table: CartTable | null
  /** Distance from the visitor's saved location, when there is one. */
  distanceKm: number | null
  /** The sections that will actually render, in order. */
  sections: ThemeSection[]
}

/** Every section component takes exactly this. */
export interface StoreSectionProps {
  context: StorefrontContext
}
