// The theme a store's pages actually wear. Pure.
import { planOfStore } from '@/lib/plans'
import { ensureReadable, normalizeTheme } from '@/lib/theme'
import { themeForPlan } from '@/lib/theme/plan-gate'
import type { StoreTheme } from '@/types/app'

/**
 * The saved theme, normalised, with what the store's plan no longer includes
 * dropped (custom CSS and the hero video are VIP) and the ink on the brand
 * colour recomputed so it stays readable. The same steps the storefront runs.
 */
export function resolveStoreTheme(store: {
  theme: unknown
  plan?: string | null
  founder_until?: string | null
}): StoreTheme {
  return ensureReadable(
    themeForPlan(normalizeTheme(store.theme), planOfStore(store)),
  ).theme
}
