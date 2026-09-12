'use client'

import { usePathname, useRouter, useSearchParams } from 'next/navigation'
import { cn } from '@/lib/utils'

export interface CategoryChip {
  name: string
  count: number
}

/** Emoji glyphs are decorative; the category name carries the meaning. */
const GLYPHS: Record<string, string> = {
  parrilla: '🥩',
  saludable: '🥗',
  italiana: '🍕',
  'comida rápida': '🍔',
  japonesa: '🍣',
  'café y panadería': '☕',
  postres: '🍰',
  mexicana: '🌮',
  colombiana: '🫓',
  pollo: '🍗',
}

export function CategoryCarousel({
  categories,
}: {
  categories: CategoryChip[]
}) {
  const router = useRouter()
  const pathname = usePathname()
  const searchParams = useSearchParams()
  const selected = searchParams.get('categoria')

  function select(name: string | null) {
    const params = new URLSearchParams(searchParams.toString())
    if (name) params.set('categoria', name)
    else params.delete('categoria')
    const query = params.toString()
    router.replace(`${pathname}${query ? `?${query}` : ''}#restaurantes`, {
      scroll: false,
    })
  }

  if (categories.length === 0) return null

  return (
    <div
      role="group"
      aria-label="Filtrar por categoría"
      className="-mx-4 flex [scrollbar-width:none] gap-2 overflow-x-auto px-4 py-1 sm:-mx-6 sm:px-6 lg:-mx-8 lg:px-8 [&::-webkit-scrollbar]:hidden"
    >
      <button
        type="button"
        aria-pressed={selected === null}
        onClick={() => select(null)}
        className={cn(
          'rounded-pill shrink-0 px-4 py-2 text-sm font-medium transition-colors',
          selected === null
            ? 'bg-foreground text-background'
            : 'bg-card text-foreground shadow-soft ring-foreground/10 hover:bg-muted ring-1',
        )}
      >
        Todo
      </button>
      {categories.map((category) => {
        const active = selected === category.name
        return (
          <button
            key={category.name}
            type="button"
            aria-pressed={active}
            onClick={() => select(active ? null : category.name)}
            className={cn(
              'rounded-pill flex shrink-0 items-center gap-2 px-4 py-2 text-sm font-medium transition-colors',
              active
                ? 'bg-foreground text-background'
                : 'bg-card text-foreground shadow-soft ring-foreground/10 hover:bg-muted ring-1',
            )}
          >
            <span aria-hidden="true">
              {GLYPHS[category.name.toLowerCase()] ?? '🍽️'}
            </span>
            {category.name}
            <span
              className={cn(
                'text-xs',
                active ? 'text-background/70' : 'text-muted-foreground',
              )}
            >
              {category.count}
            </span>
          </button>
        )
      })}
    </div>
  )
}
