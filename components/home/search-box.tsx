'use client'

import {
  LoaderCircleIcon,
  SearchIcon,
  StoreIcon,
  UtensilsIcon,
} from 'lucide-react'
import { useRouter } from 'next/navigation'
import { useEffect, useId, useRef, useState } from 'react'
import { createClient } from '@/lib/supabase/client'
import { cn } from '@/lib/utils'

interface Suggestion {
  kind: 'store' | 'product'
  id: string
  title: string
  subtitle: string
  href: string
}

async function fetchSuggestions(
  query: string,
  signal: AbortSignal,
): Promise<Suggestion[]> {
  const supabase = createClient()
  const pattern = `%${query.replace(/[%_]/g, '')}%`
  const [stores, products] = await Promise.all([
    supabase
      .from('stores')
      .select('id, slug, name, category')
      .eq('status', 'active')
      .or(`name.ilike.${pattern},category.ilike.${pattern}`)
      .limit(4)
      .abortSignal(signal),
    supabase
      .from('products')
      .select('id, name, stores!inner(slug, name, status)')
      .eq('is_available', true)
      .eq('stores.status', 'active')
      .ilike('name', pattern)
      .limit(5)
      .abortSignal(signal),
  ])

  const storeItems: Suggestion[] = (stores.data ?? []).map((store) => ({
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
  return [...storeItems, ...productItems]
}

export function SearchBox({ className }: { className?: string }) {
  const router = useRouter()
  const listId = useId()
  const [query, setQuery] = useState('')
  const [items, setItems] = useState<Suggestion[]>([])
  const [open, setOpen] = useState(false)
  const [active, setActive] = useState(-1)
  const [loading, setLoading] = useState(false)
  const abortRef = useRef<AbortController | null>(null)

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
        const results = await fetchSuggestions(query.trim(), controller.signal)
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
    router.push(item.href)
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
          className="text-muted-foreground pointer-events-none absolute top-1/2 left-4 size-5 -translate-y-1/2"
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
          className="rounded-pill bg-card shadow-soft ring-foreground/10 placeholder:text-muted-foreground focus-visible:ring-primary h-14 w-full pr-12 pl-12 text-base ring-1 outline-none focus-visible:ring-2"
        />
        {loading ? (
          <LoaderCircleIcon
            aria-hidden="true"
            className="text-muted-foreground absolute top-1/2 right-4 size-5 -translate-y-1/2 animate-spin"
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
                  {item.kind === 'store' ? (
                    <StoreIcon aria-hidden="true" className="size-4" />
                  ) : (
                    <UtensilsIcon aria-hidden="true" className="size-4" />
                  )}
                </span>
                <span className="min-w-0">
                  <span className="block truncate font-medium">
                    {item.title}
                  </span>
                  <span className="text-muted-foreground block truncate text-xs">
                    {item.kind === 'store'
                      ? item.subtitle
                      : `Plato en ${item.subtitle}`}
                  </span>
                </span>
              </button>
            </li>
          ))}
        </ul>
      ) : null}
    </div>
  )
}
