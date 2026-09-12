import { UtensilsIcon } from 'lucide-react'
import { cookies } from 'next/headers'
import { Suspense, type CSSProperties } from 'react'
import {
  SectionFallback,
  StoreSection,
} from '@/components/store/section-registry'
import { StoreCart } from '@/components/store/store-cart'
import { StoreHeader } from '@/components/store/store-header'
import { StoreLive } from '@/components/store/store-live'
import type { StorefrontContext } from '@/components/store/storefront-context'
import { TableContextSetter } from '@/components/store/table-context-setter'
import type { CartTable } from '@/lib/cart'
import { haversineKm, latLngOf } from '@/lib/geo'
import { LOCATION_COOKIE, parseLocation } from '@/lib/location'
import { fetchIsFavorite } from '@/lib/store/data'
import { storeHoursState } from '@/lib/store/hours'
import { resolveSections } from '@/lib/store/sections'
import { normalizeTheme, themeToCssVars } from '@/lib/theme'
import type { Store } from '@/types/app'

// Server rendering shared by /t/[slug] (regular storefront) and
// /t/[slug]/mesa/[token] (same storefront tagged with a table).

export { fetchStore } from '@/lib/store/data'

function TableBanner({ number }: { number: number }) {
  return (
    <div
      role="status"
      className="sticky top-0 z-40 flex items-center justify-center gap-2 bg-[var(--store-primary)] px-4 py-2.5 text-sm font-medium text-[var(--store-on-primary)]"
    >
      <UtensilsIcon aria-hidden="true" className="size-4" />
      Estás pidiendo desde la mesa {number}
    </div>
  )
}

/** Distance from the visitor's saved address, when both ends are known. */
async function visitorDistanceKm(store: Store): Promise<number | null> {
  const storePoint = latLngOf(store)
  if (!storePoint) return null
  const jar = await cookies()
  const visitor = parseLocation(jar.get(LOCATION_COOKIE)?.value)
  if (!visitor) return null
  return haversineKm(visitor, storePoint)
}

interface StorefrontProps {
  store: Store
  /** Present when the visitor arrived through a table QR code. */
  table?: CartTable | null
}

/**
 * The storefront shell.
 *
 * It owns three things and nothing else: the tenant skin (CSS variables plus
 * the merchant's sanitised CSS), the sticky header, and the ordered list of
 * sections. Every section is a separate component resolved through the
 * registry, so what renders is a data decision (`theme.sectionOrder`) rather
 * than a branch in here.
 */
export async function Storefront({ store, table = null }: StorefrontProps) {
  const theme = normalizeTheme(store.theme)
  const hours = storeHoursState({
    schedule: store.schedule,
    isOpen: Boolean(store.is_open),
    now: new Date(),
  })
  const [distanceKm, isFavorite] = await Promise.all([
    visitorDistanceKm(store),
    fetchIsFavorite(store.id),
  ])

  const sections = resolveSections(theme.sectionOrder, {
    featured: theme.featured.productIds.length > 0,
    story: theme.story.enabled && theme.story.text.trim().length > 0,
    social: Boolean(
      theme.social.instagram ||
      theme.social.tiktok ||
      theme.social.facebook ||
      (theme.social.whatsapp && store.whatsapp_phone),
    ),
    info: Boolean(
      store.address ||
      theme.footer.showSchedule ||
      (theme.footer.showMap && store.lat !== null),
    ),
  })

  const context: StorefrontContext = {
    store,
    theme,
    hours,
    table,
    distanceKm,
    sections,
  }

  return (
    <div
      id="top"
      data-store-theme
      data-store-scheme={theme.mode === 'auto' ? 'auto' : theme.mode}
      data-store-motion={theme.motion}
      style={themeToCssVars(theme) as CSSProperties}
      className="min-h-dvh bg-[var(--store-background)] font-[family-name:var(--store-font-body)] text-[var(--store-text)]"
    >
      {/* Already sanitised and scoped to [data-store-theme] by the theme layer. */}
      {theme.customCss ? <style>{theme.customCss}</style> : null}

      {/* Open/closed, schedule and skin follow the merchant's switch live. */}
      <StoreLive storeId={store.id} />

      {table ? (
        <>
          <TableBanner number={table.number} />
          <TableContextSetter
            storeId={store.id}
            storeSlug={store.slug}
            table={table}
          />
        </>
      ) : null}

      <StoreHeader
        storeId={store.id}
        storeSlug={store.slug}
        storeName={store.name}
        logoUrl={theme.logoUrl ?? store.logo_url}
        primary={theme.primary}
        isFavorite={isFavorite}
        offerSchemeToggle={theme.mode === 'auto'}
      />

      {sections.map((name) => (
        <Suspense
          key={name}
          fallback={<SectionFallback name={name} theme={theme} />}
        >
          <StoreSection name={name} context={context} />
        </Suspense>
      ))}

      <StoreCart
        minOrder={store.min_order === null ? null : Number(store.min_order)}
        storeName={store.name}
        theme={theme}
      />
    </div>
  )
}
