'use client'

import { useState } from 'react'
import { ProductCard } from '@/components/store/product-card'
import { ProductDrawer } from '@/components/store/product-drawer'
import type { CartStoreRef } from '@/lib/cart'
import { cn } from '@/lib/utils'
import type { ProductWithOptions, StoreTheme } from '@/types/app'

interface FeaturedStripProps {
  products: ProductWithOptions[]
  theme: StoreTheme
  storeRef: CartStoreRef
  storeOpen: boolean
}

/**
 * Three arrangements of the same cards:
 *
 * - `carousel` scrolls sideways with snap points, so a long list stays one row;
 * - `bento` gives the first product a double cell and packs the rest around it;
 * - `row` is a plain responsive grid for merchants who want no drama.
 */
export function FeaturedStrip({
  products,
  theme,
  storeRef,
  storeOpen,
}: FeaturedStripProps) {
  const [selected, setSelected] = useState<ProductWithOptions | null>(null)
  const layout = theme.featured.layout

  const container =
    layout === 'carousel'
      ? 'flex snap-x snap-mandatory gap-card overflow-x-auto pb-2 [scrollbar-width:thin]'
      : layout === 'bento'
        ? 'grid gap-card sm:grid-cols-2 lg:grid-cols-4'
        : 'grid gap-card sm:grid-cols-2 lg:grid-cols-4'

  return (
    <>
      <ul className={container}>
        {products.map((product, index) => (
          <li
            key={product.id}
            className={cn(
              layout === 'carousel' &&
                'w-[78%] shrink-0 snap-start sm:w-[46%] lg:w-[31%]',
              layout === 'bento' &&
                index === 0 &&
                'sm:col-span-2 sm:row-span-2 lg:col-span-2',
            )}
          >
            <ProductCard
              product={product}
              theme={theme}
              storeRef={storeRef}
              storeOpen={storeOpen}
              onOpenDrawer={setSelected}
              feature={layout === 'bento' && index === 0}
              className="h-full"
            />
          </li>
        ))}
      </ul>

      <ProductDrawer
        product={selected}
        theme={theme}
        store={{ ...storeRef, isOpen: storeOpen }}
        onClose={() => setSelected(null)}
      />
    </>
  )
}
