'use client'

import { useSearchParams } from 'next/navigation'
import { useEffect, useMemo, useState } from 'react'
import { CategoryNav, categorySectionId } from '@/components/store/category-nav'
import { useMenuSearch } from '@/components/store/menu-search-store'
import { ProductCard } from '@/components/store/product-card'
import { ProductDrawer } from '@/components/store/product-drawer'
import { StoreEmptyState } from '@/components/store/store-empty-state'
import type { CartTable } from '@/lib/cart'
import { menuLayoutStrategy } from '@/lib/store/menu-layout'
import { filterMenu } from '@/lib/store/search'
import { cn } from '@/lib/utils'
import type {
  MenuCategoryWithProducts,
  ProductWithOptions,
  StoreTheme,
} from '@/types/app'

export interface StoreMenuStore {
  id: string
  slug: string
  name: string
  isOpen: boolean
  minOrder: number | null
}

interface StoreMenuProps {
  store: StoreMenuStore
  theme: StoreTheme
  categories: MenuCategoryWithProducts[]
  /** Set when the menu is rendered from a table QR entry page. */
  table?: CartTable | null
}

/**
 * The menu itself: sticky category nav, one section per category, and the four
 * layouts applied as CSS strategies over a single card component.
 */
export function StoreMenu({
  store,
  theme,
  categories,
  table = null,
}: StoreMenuProps) {
  const searchParams = useSearchParams()
  const query = useMenuSearch((state) => state.query)
  const [selected, setSelected] = useState<ProductWithOptions | null>(null)

  const products = useMemo(
    () => categories.flatMap((category) => category.products),
    [categories],
  )

  // Deep link from the home search: /t/slug?buscar=Nombre opens the product.
  useEffect(() => {
    const deepLink = searchParams.get('buscar')?.toLowerCase()
    if (!deepLink) return
    const match = products.find(
      (product) => product.name.toLowerCase() === deepLink,
    )
    if (match) setSelected(match)
  }, [searchParams, products])

  const visible = useMemo(
    () => filterMenu(categories, query),
    [categories, query],
  )
  const strategy = menuLayoutStrategy(theme.menuLayout)
  const sidebar = theme.categoryNav === 'sidebar'
  const storeRef = { storeId: store.id, storeSlug: store.slug, table }

  const nav = (
    <CategoryNav
      categories={visible.map((category) => ({
        id: category.id,
        name: category.name,
      }))}
      variant={theme.categoryNav}
      motion={theme.motion}
    />
  )

  const list =
    categories.length === 0 ? (
      <StoreEmptyState
        title="El menú está en preparación"
        description="Este restaurante todavía no ha publicado productos disponibles."
        className="mt-8"
      />
    ) : visible.length === 0 ? (
      <StoreEmptyState
        illustration="search"
        title={`No encontramos “${query}”`}
        description="Prueba con otro nombre, un ingrediente o revisa las categorías del menú."
        className="mt-8"
      />
    ) : (
      <div className="space-y-[var(--store-density-section)] pt-8">
        {visible.map((category, categoryIndex) => (
          <section
            key={category.id}
            id={categorySectionId(category.id)}
            aria-labelledby={`${categorySectionId(category.id)}-title`}
            className="scroll-mt-[var(--store-scroll-offset)]"
          >
            <h3
              id={`${categorySectionId(category.id)}-title`}
              className="store-heading text-h2 mb-5 text-[var(--store-text)]"
            >
              {category.name}
            </h3>
            <div className={strategy.container}>
              {category.products.map((product, index) => (
                <div key={product.id} className={strategy.item(index)}>
                  <ProductCard
                    product={product}
                    theme={theme}
                    storeRef={storeRef}
                    storeOpen={store.isOpen}
                    onOpenDrawer={setSelected}
                    query={query}
                    orientation={strategy.orientation}
                    feature={strategy.feature(index)}
                    fixedRatio={strategy.fixedRatio}
                    priority={categoryIndex === 0 && index < 2}
                  />
                </div>
              ))}
            </div>
          </section>
        ))}
      </div>
    )

  return (
    <>
      {sidebar ? (
        <div className="gap-inline grid lg:grid-cols-[14rem_1fr]">
          <div className="lg:pt-8">{nav}</div>
          <div className="min-w-0">{list}</div>
        </div>
      ) : (
        <div className={cn('min-w-0')}>
          {nav}
          {list}
        </div>
      )}

      <ProductDrawer
        product={selected}
        theme={theme}
        store={{ ...storeRef, isOpen: store.isOpen }}
        onClose={() => setSelected(null)}
      />
    </>
  )
}
