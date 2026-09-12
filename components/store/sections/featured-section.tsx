import { SectionShell } from '@/components/store/sections/section-shell'
import type { StoreSectionProps } from '@/components/store/storefront-context'
import { FeaturedStrip } from '@/components/store/sections/featured-strip'
import { fetchMenu } from '@/lib/store/data'

/**
 * The products the merchant chose to put first. Empty `productIds` means the
 * section was never configured, and `resolveSections` will already have
 * dropped it — this guard only covers a theme pointing at deleted products.
 */
export async function FeaturedSection({ context }: StoreSectionProps) {
  const { store, theme, table } = context
  const categories = await fetchMenu(store.id)
  const byId = new Map(
    categories.flatMap((category) =>
      category.products.map((product) => [product.id, product] as const),
    ),
  )
  const products = theme.featured.productIds
    .map((id) => byId.get(id))
    .filter((product) => product !== undefined)

  if (products.length === 0) return null

  return (
    <SectionShell id="destacados" title={theme.featured.title} tone="surface">
      <FeaturedStrip
        products={products}
        theme={theme}
        storeRef={{ storeId: store.id, storeSlug: store.slug, table }}
        storeOpen={Boolean(store.is_open)}
      />
    </SectionShell>
  )
}
