'use client'

import { PlusIcon } from 'lucide-react'
import Image from 'next/image'
import { useSearchParams } from 'next/navigation'
import { useEffect, useMemo, useState } from 'react'
import { CategoryNav } from '@/app/(public)/t/[slug]/category-nav'
import { CartFab } from '@/components/store/cart-fab'
import { CartSheet } from '@/components/store/cart-sheet'
import { ProductDrawer } from '@/components/store/product-drawer'
import { EmptyState } from '@/components/ui/empty-state'
import { PriceChip } from '@/components/ui/price-chip'
import type { CartTable } from '@/lib/cart'
import { formatCOP } from '@/lib/format'
import type { MenuCategoryWithProducts, ProductWithOptions } from '@/types/app'

export interface StoreMenuStore {
  id: string
  slug: string
  name: string
  isOpen: boolean
  minOrder: number | null
}

interface StoreMenuProps {
  store: StoreMenuStore
  categories: MenuCategoryWithProducts[]
  /** Set when the menu is rendered from a table QR entry page. */
  table?: CartTable | null
}

function ProductCard({
  product,
  onSelect,
}: {
  product: ProductWithOptions
  onSelect: () => void
}) {
  return (
    <button
      type="button"
      onClick={onSelect}
      aria-label={`Ver ${product.name}, ${formatCOP(Number(product.price))}`}
      className="group shadow-soft hover:shadow-lift flex w-full gap-4 rounded-[var(--store-radius)] bg-[var(--store-surface)] p-3 text-left ring-1 ring-[rgb(var(--store-text-rgb)/0.06)] transition-all focus-visible:ring-2 focus-visible:ring-[var(--store-primary)] sm:flex-col sm:p-0"
    >
      <div className="relative aspect-square w-28 shrink-0 overflow-hidden rounded-[calc(var(--store-radius)-6px)] bg-[rgb(var(--store-text-rgb)/0.06)] sm:aspect-[4/3] sm:w-full sm:rounded-t-[var(--store-radius)] sm:rounded-b-none">
        {product.image_url ? (
          <Image
            src={product.image_url}
            alt=""
            fill
            sizes="(min-width: 1024px) 25vw, (min-width: 640px) 50vw, 112px"
            className="object-cover transition-transform duration-700 ease-out group-hover:scale-[1.04]"
          />
        ) : null}
        <div
          aria-hidden="true"
          className="absolute inset-0 hidden bg-gradient-to-t from-black/45 to-transparent sm:block"
        />
        <PriceChip
          amount={Number(product.price)}
          className="absolute bottom-2 left-2 hidden sm:inline-flex"
        />
        <span
          aria-hidden="true"
          className="shadow-lift absolute right-2 bottom-2 hidden size-9 items-center justify-center rounded-full bg-[var(--store-primary)] text-white transition-transform group-hover:scale-110 sm:flex"
        >
          <PlusIcon className="size-4" />
        </span>
      </div>
      <div className="flex min-w-0 flex-1 flex-col gap-1 sm:p-4">
        <h3 className="font-[family-name:var(--store-font-display)] text-lg leading-tight font-semibold text-[var(--store-text)]">
          {product.name}
        </h3>
        {product.description ? (
          <p className="line-clamp-2 text-sm text-[rgb(var(--store-text-rgb)/0.7)]">
            {product.description}
          </p>
        ) : null}
        <p className="mt-auto pt-1 text-sm font-semibold text-[var(--store-primary)] sm:hidden">
          {formatCOP(Number(product.price))}
        </p>
        {product.tags && product.tags.length > 0 ? (
          <ul
            className="mt-1 hidden flex-wrap gap-1.5 sm:flex"
            aria-label="Etiquetas"
          >
            {product.tags.slice(0, 3).map((tag) => (
              <li
                key={tag}
                className="rounded-pill bg-[rgb(var(--store-accent-rgb)/0.18)] px-2 py-0.5 text-[11px] font-medium text-[var(--store-text)]"
              >
                {tag}
              </li>
            ))}
          </ul>
        ) : null}
      </div>
    </button>
  )
}

export function StoreMenu({ store, categories, table = null }: StoreMenuProps) {
  const searchParams = useSearchParams()
  const [selected, setSelected] = useState<ProductWithOptions | null>(null)

  const products = useMemo(
    () => categories.flatMap((category) => category.products),
    [categories],
  )

  // Deep link from the home search: /t/slug?buscar=Nombre opens the product.
  useEffect(() => {
    const query = searchParams.get('buscar')?.toLowerCase()
    if (!query) return
    const match = products.find(
      (product) => product.name.toLowerCase() === query,
    )
    if (match) setSelected(match)
  }, [searchParams, products])

  return (
    <>
      <CategoryNav
        categories={categories.map((category) => ({
          id: category.id,
          name: category.name,
        }))}
      />

      {categories.length === 0 ? (
        <div className="pt-8">
          <EmptyState
            title="El menú está en preparación"
            description="Este restaurante todavía no ha publicado productos disponibles."
          />
        </div>
      ) : (
        <div className="space-y-12 pt-8">
          {categories.map((category) => (
            <section
              key={category.id}
              id={`categoria-${category.id}`}
              aria-labelledby={`categoria-${category.id}-title`}
              className="scroll-mt-36"
            >
              <h3
                id={`categoria-${category.id}-title`}
                className="mb-5 font-[family-name:var(--store-font-display)] text-3xl font-semibold tracking-tight"
              >
                {category.name}
              </h3>
              <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4">
                {category.products.map((product) => (
                  <ProductCard
                    key={product.id}
                    product={product}
                    onSelect={() => setSelected(product)}
                  />
                ))}
              </div>
            </section>
          ))}
        </div>
      )}

      <ProductDrawer
        product={selected}
        store={{
          storeId: store.id,
          storeSlug: store.slug,
          isOpen: store.isOpen,
          table,
        }}
        onClose={() => setSelected(null)}
      />
      <CartSheet minOrder={store.minOrder} storeName={store.name} />
      <CartFab />
    </>
  )
}
