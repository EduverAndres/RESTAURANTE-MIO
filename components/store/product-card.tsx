'use client'

import { PlusIcon, SettingsIcon } from 'lucide-react'
import { useMemo } from 'react'
import { toast } from 'sonner'
import { Highlight } from '@/components/store/highlight'
import { ProductBadge, productBadgeOf } from '@/components/store/product-badge'
import { QuantityStepper } from '@/components/store/quantity-stepper'
import { StoreImage } from '@/components/store/store-image'
import { cartItemKey, type CartStoreRef } from '@/lib/cart'
import { formatCOP } from '@/lib/format'
import { masonryRatio } from '@/lib/store/menu-layout'
import { cn } from '@/lib/utils'
import { useCartStore } from '@/stores/cart.store'
import type { ProductWithOptions, StoreTheme } from '@/types/app'

interface ProductCardProps {
  product: ProductWithOptions
  theme: StoreTheme
  storeRef: CartStoreRef
  storeOpen: boolean
  /** Opens the drawer; only products with option groups need it. */
  onOpenDrawer: (product: ProductWithOptions) => void
  /** Current menu search, highlighted inside the name and description. */
  query?: string
  orientation?: 'row' | 'column'
  /** The wide, long-description treatment of the magazine layout. */
  feature?: boolean
  /** `false` lets the image keep a seeded height (masonry). */
  fixedRatio?: boolean
  priority?: boolean
  className?: string
}

/**
 * One product, in every layout.
 *
 * The conversion detail lives here: for a product with no option groups the
 * "+" adds it straight to the cart and morphs into a `− 1 +` stepper in place.
 * The drawer only opens when there is genuinely something to choose, so the
 * common case is one tap instead of three.
 */
export function ProductCard({
  product,
  theme,
  storeRef,
  storeOpen,
  onOpenDrawer,
  query = '',
  orientation = 'column',
  feature = false,
  fixedRatio = true,
  priority = false,
  className,
}: ProductCardProps) {
  const add = useCartStore((state) => state.add)
  const setQuantity = useCartStore((state) => state.setQuantity)
  const items = useCartStore((state) => state.items)

  const hasOptions = product.product_options.length > 0
  const price = Number(product.price)

  // The line this card owns: the product with no options and no notes. A
  // configured line lives under a different key and is edited in the cart.
  const plainKey = useMemo(
    () =>
      cartItemKey({
        productId: product.id,
        name: product.name,
        unitPrice: price,
        imageUrl: product.image_url,
        options: [],
        optionValueIds: [],
        notes: '',
      }),
    [product.id, product.name, product.image_url, price],
  )
  const inCart = items.find((item) => item.key === plainKey)?.quantity ?? 0

  const badge = productBadgeOf(
    product,
    theme.badges,
    theme.featured.productIds,
    new Date(),
  )
  const row = orientation === 'row'
  const hover = theme.productHover
  const priceHidden = theme.showPrices === 'on-hover'

  function addOne() {
    if (hasOptions) {
      onOpenDrawer(product)
      return
    }
    if (!storeOpen) {
      toast.error('Este restaurante está cerrado en este momento.')
      return
    }
    add(
      storeRef,
      {
        productId: product.id,
        name: product.name,
        unitPrice: price,
        imageUrl: product.image_url,
        options: [],
        optionValueIds: [],
        notes: '',
      },
      1,
    )
  }

  const mediaStyle = fixedRatio
    ? undefined
    : { aspectRatio: masonryRatio(product.id) }

  return (
    <article
      className={cn(
        'group store-card relative isolate flex',
        row ? 'flex-row items-stretch gap-3 p-3' : 'flex-col',
        feature && !row && 'sm:flex-row sm:items-stretch',
        'shadow-[var(--store-card-shadow)] [border:var(--store-card-border)]',
        'transition-[transform,box-shadow] duration-[var(--store-motion-duration)] ease-[var(--ease-out-soft)]',
        hover === 'lift' && 'hover:shadow-2 hover:-translate-y-1',
        'focus-within:ring-2 focus-within:ring-[var(--store-primary)] focus-within:ring-offset-2 focus-within:ring-offset-[var(--store-background)]',
        className,
      )}
    >
      <div
        className={cn(
          'relative shrink-0 overflow-hidden bg-[rgb(var(--store-text-rgb)/0.05)]',
          row
            ? 'order-2 size-24 rounded-[var(--store-image-radius)] sm:size-28'
            : 'w-full rounded-t-[var(--store-radius)]',
          feature && !row && 'sm:order-2 sm:w-2/5 sm:rounded-t-none',
        )}
        style={
          row
            ? undefined
            : { aspectRatio: 'var(--store-image-ratio)', ...mediaStyle }
        }
      >
        <StoreImage
          src={product.image_url}
          alt={product.name}
          seed={product.id}
          color={theme.primary}
          label={product.name}
          sizes={
            row
              ? '112px'
              : '(min-width: 1024px) 33vw, (min-width: 640px) 50vw, 100vw'
          }
          priority={priority}
          className={cn(
            'transition-transform duration-700 ease-out',
            hover === 'zoom' && 'group-hover:scale-[1.06]',
          )}
        />

        {badge ? (
          <ProductBadge
            kind={badge}
            style={theme.badges.style}
            className="absolute top-2 left-2 z-10"
          />
        ) : null}

        {hover === 'reveal' && product.description && !row ? (
          <p
            aria-hidden="true"
            className="absolute inset-0 z-10 flex items-end bg-gradient-to-t from-black/80 to-transparent p-3 text-sm text-white opacity-0 transition-opacity duration-[var(--store-motion-duration)] group-hover:opacity-100"
          >
            <span className="line-clamp-3">{product.description}</span>
          </p>
        ) : null}
      </div>

      <div
        className={cn(
          'flex min-w-0 flex-1 flex-col gap-1',
          row ? 'order-1 py-1' : 'p-[var(--store-density-padding)]',
          feature && !row && 'sm:order-1 sm:justify-center',
        )}
      >
        <h4 className="store-heading text-h3 leading-tight text-[var(--store-text)]">
          {/* The pseudo-element turns the whole card into the hit area while
              the accessible name stays on a single real button. */}
          <button
            type="button"
            onClick={() => onOpenDrawer(product)}
            aria-haspopup="dialog"
            // The visible name is part of the accessible name, so the verb
            // only adds what the button does (WCAG 2.5.3 label in name).
            aria-label={`Ver ${product.name}`}
            className="text-left after:absolute after:inset-0 after:content-[''] focus-visible:outline-none"
          >
            <Highlight text={product.name} query={query} />
          </button>
        </h4>

        {product.description ? (
          <p
            className={cn(
              'text-sm text-[rgb(var(--store-text-rgb)/0.7)]',
              feature ? 'line-clamp-4' : 'line-clamp-2',
            )}
          >
            <Highlight text={product.description} query={query} />
          </p>
        ) : null}

        {product.tags && product.tags.length > 0 ? (
          <ul className="mt-1 flex flex-wrap gap-1.5" aria-label="Etiquetas">
            {product.tags.slice(0, 3).map((tag) => (
              <li
                key={tag}
                className="rounded-pill bg-[rgb(var(--store-accent-rgb)/0.18)] px-2 py-0.5 text-[11px] font-medium"
              >
                {tag}
              </li>
            ))}
          </ul>
        ) : null}

        <div className="mt-auto flex items-center justify-between gap-2 pt-2">
          <span
            className={cn(
              'text-lead font-semibold text-[var(--store-primary)] tabular-nums transition-opacity',
              priceHidden &&
                'opacity-0 group-focus-within:opacity-100 group-hover:opacity-100',
            )}
          >
            {formatCOP(price)}
          </span>

          {/* Above the card-wide hit area, so the stepper never opens the drawer. */}
          <div className="relative z-10">
            {inCart > 0 && !hasOptions ? (
              <QuantityStepper
                quantity={inCart}
                itemLabel={product.name}
                onDecrement={() => setQuantity(plainKey, inCart - 1)}
                onIncrement={() => setQuantity(plainKey, inCart + 1)}
              />
            ) : (
              <button
                type="button"
                onClick={addOne}
                aria-label={
                  hasOptions
                    ? `Elegir opciones de ${product.name}`
                    : `Agregar ${product.name} al carrito`
                }
                aria-haspopup={hasOptions ? 'dialog' : undefined}
                // Grows to a 56px square in table mode; see globals.css.
                data-table-primary="round"
                className="store-btn shadow-2 size-10 transition-transform hover:scale-105 active:scale-95"
              >
                {hasOptions ? (
                  <SettingsIcon aria-hidden="true" className="size-4" />
                ) : (
                  <PlusIcon aria-hidden="true" className="size-5" />
                )}
              </button>
            )}
          </div>
        </div>
      </div>
    </article>
  )
}
