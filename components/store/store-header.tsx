'use client'

import { SearchIcon, XIcon } from 'lucide-react'
import Image from 'next/image'
import { useEffect, useRef, useState } from 'react'
import { FavoriteButton } from '@/components/store/favorite-button'
import { useMenuSearch } from '@/components/store/menu-search-store'
import { PlaceholderImage } from '@/components/store/placeholder-image'
import { SchemeToggle } from '@/components/store/scheme-toggle'
import { cn } from '@/lib/utils'

interface StoreHeaderProps {
  storeId: string
  storeSlug: string
  storeName: string
  logoUrl: string | null
  primary: string
  isFavorite: boolean
  /** The merchant chose `mode: "auto"`, so the visitor gets the choice. */
  offerSchemeToggle: boolean
}

/**
 * The storefront's own bar, under the site header: identity on the left,
 * search in the middle, the two personal controls on the right. It stays
 * visible while the visitor scrolls the menu, so searching never means
 * scrolling back to the top.
 */
export function StoreHeader({
  storeId,
  storeSlug,
  storeName,
  logoUrl,
  primary,
  isFavorite,
  offerSchemeToggle,
}: StoreHeaderProps) {
  const query = useMenuSearch((state) => state.query)
  const setQuery = useMenuSearch((state) => state.setQuery)
  const reset = useMenuSearch((state) => state.reset)
  const [expanded, setExpanded] = useState(false)
  const inputRef = useRef<HTMLInputElement>(null)

  useEffect(() => {
    if (expanded) inputRef.current?.focus()
  }, [expanded])

  // The search term belongs to this visit, not to the next one.
  useEffect(() => () => reset(), [reset])

  return (
    <div className="sticky top-[var(--site-header-h)] z-40 border-b border-[rgb(var(--store-text-rgb)/0.08)] bg-[rgb(var(--store-background-rgb)/0.9)] backdrop-blur-md">
      <div className="container-page flex h-[var(--store-header-h)] items-center gap-3">
        <a
          href="#top"
          className="flex min-w-0 items-center gap-2.5"
          aria-label={`Volver al inicio de ${storeName}`}
        >
          <span className="relative size-8 shrink-0 overflow-hidden rounded-full bg-[var(--store-surface)]">
            {logoUrl ? (
              <Image
                src={logoUrl}
                alt=""
                fill
                sizes="32px"
                className="object-cover"
              />
            ) : (
              <PlaceholderImage
                seed={`logo-${storeSlug}`}
                color={primary}
                label={storeName}
                initialScale={1.3}
              />
            )}
          </span>
          <span
            className={cn(
              'store-heading truncate text-base text-[var(--store-text)]',
              expanded && 'hidden sm:block',
            )}
          >
            {storeName}
          </span>
        </a>

        <div
          className={cn(
            'ml-auto flex min-w-0 items-center gap-2',
            expanded && 'flex-1',
          )}
        >
          <div
            className={cn(
              'relative min-w-0',
              expanded ? 'flex-1' : 'hidden sm:block sm:w-56',
            )}
          >
            <label htmlFor="store-search" className="sr-only">
              Buscar en el menú de {storeName}
            </label>
            <SearchIcon
              aria-hidden="true"
              className="pointer-events-none absolute top-1/2 left-3 size-4 -translate-y-1/2 text-[rgb(var(--store-text-rgb)/0.5)]"
            />
            <input
              ref={inputRef}
              id="store-search"
              type="search"
              value={query}
              onChange={(event) => setQuery(event.target.value)}
              onKeyDown={(event) => {
                if (event.key === 'Escape') {
                  setQuery('')
                  setExpanded(false)
                }
              }}
              placeholder="Buscar un plato…"
              autoComplete="off"
              className="h-9 w-full rounded-[var(--store-button-radius)] border border-[rgb(var(--store-text-rgb)/0.12)] bg-[var(--store-surface)] pr-8 pl-9 text-sm text-[var(--store-text)] placeholder:text-[rgb(var(--store-text-rgb)/0.45)] focus-visible:border-[var(--store-primary)] focus-visible:ring-2 focus-visible:ring-[rgb(var(--store-primary-rgb)/0.3)] focus-visible:outline-none [&::-webkit-search-cancel-button]:hidden"
            />
            {query ? (
              <button
                type="button"
                onClick={() => setQuery('')}
                aria-label="Borrar la búsqueda"
                className="absolute top-1/2 right-2 flex size-6 -translate-y-1/2 items-center justify-center rounded-full text-[rgb(var(--store-text-rgb)/0.6)] hover:bg-[rgb(var(--store-text-rgb)/0.08)]"
              >
                <XIcon aria-hidden="true" className="size-3.5" />
              </button>
            ) : null}
          </div>

          <button
            type="button"
            onClick={() => setExpanded((value) => !value)}
            aria-expanded={expanded}
            aria-label="Buscar en el menú"
            className="inline-flex size-9 items-center justify-center rounded-full bg-[rgb(var(--store-text-rgb)/0.07)] text-[var(--store-text)] sm:hidden"
          >
            {expanded ? (
              <XIcon aria-hidden="true" className="size-4" />
            ) : (
              <SearchIcon aria-hidden="true" className="size-4" />
            )}
          </button>

          {offerSchemeToggle ? <SchemeToggle storeSlug={storeSlug} /> : null}

          <FavoriteButton
            storeId={storeId}
            storeName={storeName}
            initial={isFavorite}
            className="size-9 bg-[rgb(var(--store-text-rgb)/0.07)] text-[var(--store-text)] backdrop-blur-none"
          />
        </div>
      </div>
    </div>
  )
}
