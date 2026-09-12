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

/**
 * The glyph lives in its own tinted medallion rather than sitting inline with
 * the text: at a glance the row reads as a strip of pictures, which is what
 * makes it scannable while scrolling, and the label underneath is what makes
 * it usable when the picture means nothing to you.
 */
function Glyph({ name, active }: { name: string; active: boolean }) {
  return (
    <span
      aria-hidden="true"
      className={cn(
        'grid size-7 shrink-0 place-items-center rounded-full text-base leading-none',
        active ? 'bg-background/20' : 'bg-primary/10',
      )}
    >
      {GLYPHS[name.toLowerCase()] ?? '🍽️'}
    </span>
  )
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
      className="rail -mx-gutter px-gutter gap-2 py-1"
    >
      <button
        type="button"
        aria-pressed={selected === null}
        onClick={() => select(null)}
        className={cn(
          'rounded-pill h-12 px-5 text-sm font-medium transition-colors',
          selected === null
            ? 'bg-foreground text-background'
            : 'bg-card text-foreground shadow-1 ring-foreground/10 hover:bg-muted ring-1',
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
              'rounded-pill flex h-12 items-center gap-2 pr-4 pl-2 text-sm font-medium transition-colors',
              active
                ? 'bg-foreground text-background'
                : 'bg-card text-foreground shadow-1 ring-foreground/10 hover:bg-muted ring-1',
            )}
          >
            <Glyph name={category.name} active={active} />
            {category.name}
            <span
              className={cn(
                'text-xs tabular-nums',
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
