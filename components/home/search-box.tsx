'use client'

import {
  LoaderCircleIcon,
  MegaphoneIcon,
  SearchIcon,
  StoreIcon,
  UtensilsIcon,
} from 'lucide-react'
import { useRouter } from 'next/navigation'
import { useEffect, useId, useRef, useState } from 'react'
import {
  sponsoredHref,
  sponsorshipsForSearch,
  type Sponsorship,
} from '@/lib/ads/placement'
import { SPONSORED_LABEL } from '@/lib/ads/vocabulary'
import { createClient } from '@/lib/supabase/client'
import { cn } from '@/lib/utils'

interface Suggestion {
  kind: 'store' | 'product'
  id: string
  title: string
  subtitle: string
  href: string
  /** A paid search placement: labelled, and reached through the click counter. */
  sponsored?: boolean
}

/**
 * The search campaigns on the air, once per page view. Any failure (or a
 * database without the ads migration) means no sponsored suggestions.
 */
async function fetchSearchSponsorships(): Promise<Sponsorship[]> {
  try {
    const { data, error } = await createClient().rpc('sponsored_stores', {
      p_placement: 'search_top',
    })
    if (error || !data) return []
    return data.map((row) => ({
      campaignId: row.campaign_id,
      storeId: row.store_id,
      slug: row.slug,
      name: row.name,
      category: row.category ?? null,
    }))
  } catch {
    return []
  }
}

async function fetchSuggestions(
  query: string,
  signal: AbortSignal,
  sponsorships: Promise<Sponsorship[]>,
): Promise<Suggestion[]> {
  const supabase = createClient()
  const pattern = `%${query.replace(/[%_]/g, '')}%`
  const [stores, products, campaigns] = await Promise.all([
    supabase
      .from('stores')
      .select('id, slug, name, category')
      .eq('status', 'active')
      .or(`name.ilike.${pattern},category.ilike.${pattern}`)
      .limit(4)
      .abortSignal(signal),
    supabase
      .from('products')
      .select('id, name, store_id, stores!inner(slug, name, status)')
      .eq('is_available', true)
      .eq('stores.status', 'active')
      .ilike('name', pattern)
      .limit(5)
      .abortSignal(signal),
    sponsorships,
  ])

  // The paid slot comes first, only when it is relevant to what was typed
  // (the store, its category or one of its dishes matched), and replaces the
  // store's own suggestion instead of repeating it.
  const matched = new Set([
    ...(stores.data ?? []).map((store) => store.id),
    ...(products.data ?? []).map((product) => product.store_id),
  ])
  const sponsored = sponsorshipsForSearch(campaigns, query, matched)
  const sponsoredIds = new Set(sponsored.map((item) => item.storeId))
  const sponsoredItems: Suggestion[] = sponsored.map((item) => ({
    kind: 'store',
    id: item.campaignId,
    title: item.name,
    subtitle: item.category ?? 'Restaurante',
    href: sponsoredHref(item.campaignId),
    sponsored: true,
  }))
  const storeItems: Suggestion[] = (stores.data ?? [])
    .filter((store) => !sponsoredIds.has(store.id))
    .map((store) => ({
      kind: 'store',
      id: store.id,
      title: store.name,
      subtitle: store.category ?? 'Restaurante',
      href: `/t/${store.slug}`,
    }))
  const productItems: Suggestion[] = (products.data ?? []).map((product) => ({
    kind: 'product',
    id: product.id,
    title: product.name,
    subtitle: product.stores?.name ?? '',
    href: `/t/${product.stores?.slug ?? ''}?buscar=${encodeURIComponent(product.name)}`,
  }))
  return [...sponsoredItems, ...storeItems, ...productItems]
}

interface SearchBoxProps {
  className?: string
  /** `hero` is the home page's protagonist: taller, rounder, more elevated. */
  size?: 'default' | 'hero'
}

export function SearchBox({ className, size = 'default' }: SearchBoxProps) {
  const hero = size === 'hero'
  const router = useRouter()
  const listId = useId()
  const [query, setQuery] = useState('')
  const [items, setItems] = useState<Suggestion[]>([])
  const [open, setOpen] = useState(false)
  const [active, setActive] = useState(-1)
  const [loading, setLoading] = useState(false)
  const abortRef = useRef<AbortController | null>(null)
  const sponsorshipsRef = useRef<Promise<Sponsorship[]> | null>(null)

  useEffect(() => {
    abortRef.current?.abort()
    if (query.trim().length < 2) {
      setItems([])
      setLoading(false)
      return
    }
    const controller = new AbortController()
    abortRef.current = controller
    setLoading(true)
    const timer = setTimeout(async () => {
      try {
        sponsorshipsRef.current ??= fetchSearchSponsorships()
        const results = await fetchSuggestions(
          query.trim(),
          controller.signal,
          sponsorshipsRef.current,
        )
        if (!controller.signal.aborted) {
          setItems(results)
          setOpen(true)
          setActive(-1)
        }
      } catch {
        if (!controller.signal.aborted) setItems([])
      } finally {
        if (!controller.signal.aborted) setLoading(false)
      }
    }, 250)
    return () => clearTimeout(timer)
  }, [query])

  function go(item: Suggestion) {
    setOpen(false)
    // The click counter is a route handler that redirects: a full
    // navigation, never a client-side one (nor a prefetch).
    if (item.sponsored) window.location.assign(item.href)
    else router.push(item.href)
  }

  function onKeyDown(event: React.KeyboardEvent<HTMLInputElement>) {
    if (!open || items.length === 0) return
    if (event.key === 'ArrowDown') {
      event.preventDefault()
      setActive((index) => (index + 1) % items.length)
    } else if (event.key === 'ArrowUp') {
      event.preventDefault()
      setActive((index) => (index - 1 + items.length) % items.length)
    } else if (event.key === 'Enter' && active >= 0) {
      event.preventDefault()
      go(items[active])
    } else if (event.key === 'Escape') {
      setOpen(false)
    }
  }

  return (
    <div className={cn('relative', className)}>
      <div className="relative">
        <SearchIcon
          aria-hidden="true"
          className={cn(
            'text-muted-foreground pointer-events-none absolute top-1/2 -translate-y-1/2',
            hero ? 'left-5 size-6' : 'left-4 size-5',
          )}
        />
        <input
          type="search"
          role="combobox"
          aria-expanded={open && items.length > 0}
          aria-controls={listId}
          aria-autocomplete="list"
          aria-label="Buscar restaurantes o platos"
          placeholder="¿Qué se te antoja hoy?"
          value={query}
          onChange={(event) => setQuery(event.target.value)}
          onFocus={() => items.length > 0 && setOpen(true)}
          onBlur={() => setTimeout(() => setOpen(false), 120)}
          onKeyDown={onKeyDown}
          className={cn(
            'rounded-pill bg-card ring-foreground/10 placeholder:text-muted-foreground focus-visible:ring-primary w-full ring-1 outline-none focus-visible:ring-2',
            hero
              ? 'shadow-2 h-16 pr-14 pl-14 text-lg'
              : 'shadow-1 h-14 pr-12 pl-12 text-base',
          )}
        />
        {loading ? (
          <LoaderCircleIcon
            aria-hidden="true"
            className={cn(
              'text-muted-foreground absolute top-1/2 size-5 -translate-y-1/2 animate-spin',
              hero ? 'right-5' : 'right-4',
            )}
          />
        ) : null}
      </div>

      {open && items.length > 0 ? (
        <ul
          id={listId}
          role="listbox"
          className="rounded-card border-border bg-popover shadow-lift absolute z-30 mt-2 w-full overflow-hidden border p-1.5"
        >
          {items.map((item, index) => (
            <li key={`${item.kind}-${item.id}`}>
              <button
                type="button"
                role="option"
                aria-selected={index === active}
                onMouseDown={(event) => event.preventDefault()}
                onClick={() => go(item)}
                className={cn(
                  'rounded-control flex w-full items-center gap-3 px-3 py-2 text-left text-sm',
                  index === active ? 'bg-muted' : 'hover:bg-muted',
                )}
              >
                <span className="rounded-control bg-primary/10 text-primary-on-tint flex size-8 shrink-0 items-center justify-center">
                  {item.sponsored ? (
                    <MegaphoneIcon aria-hidden="true" className="size-4" />
                  ) : item.kind === 'store' ? (
                    <StoreIcon aria-hidden="true" className="size-4" />
                  ) : (
                    <UtensilsIcon aria-hidden="true" className="size-4" />
                  )}
                </span>
                <span className="min-w-0 flex-1">
                  <span className="block truncate font-medium">
                    {item.title}
                  </span>
                  <span className="text-muted-foreground block truncate text-xs">
                    {item.kind === 'store'
                      ? item.subtitle
                      : `Plato en ${item.subtitle}`}
                  </span>
                </span>
                {/* Visible, in words (Ley 1480). */}
                {item.sponsored ? (
                  <span className="rounded-pill bg-foreground/80 text-background shrink-0 px-2 py-0.5 text-xs font-medium">
                    {SPONSORED_LABEL}
                  </span>
                ) : null}
              </button>
            </li>
          ))}
        </ul>
      ) : null}
    </div>
  )
}
