import { ArrowRightIcon } from 'lucide-react'
import Link from 'next/link'
import { FadeIn } from '@/components/motion/fade-in'
import type { VerticalSummary } from '@/lib/marketplace/verticals'
import { cn } from '@/lib/utils'

/**
 * The marketplace's shelves, before the list of stores.
 *
 * A filled shelf is a link into the home's existing `?categoria=` filter (or
 * straight to the list, for the restaurants that make up most of it). An
 * empty one stays on the shelf, quieter and not clickable — sending a diner
 * to "Nada de Farmacia por aquí todavía" is a dead end — and the line under
 * the grid turns the gap into the pitch: be the first one in your category.
 */
export function MarketplaceCategories({
  verticals,
}: {
  verticals: VerticalSummary[]
}) {
  const missing = verticals.filter((vertical) => vertical.count === 0)

  return (
    <section aria-labelledby="categorias-title" className="mb-10">
      <FadeIn inView>
        <div className="mb-4 flex flex-wrap items-end justify-between gap-2">
          <h2
            id="categorias-title"
            className="text-h2 font-display font-semibold"
          >
            Todo lo que necesitas, cerca
          </h2>
          <p className="text-muted-foreground text-sm">
            Comida, mercado, regalos y más, de negocios de aquí.
          </p>
        </div>

        <ul className="grid grid-cols-4 gap-2 sm:gap-3 lg:grid-cols-8">
          {verticals.map((vertical) => (
            <li key={vertical.key}>
              <VerticalTile vertical={vertical} />
            </li>
          ))}
        </ul>

        {missing.length > 0 ? (
          <p className="text-muted-foreground mt-4 text-sm text-pretty">
            ¿Tienes{' '}
            {missing
              .slice(0, 3)
              .map((vertical) => vertical.label.toLowerCase())
              .join(', ')}{' '}
            u otro negocio local?{' '}
            <Link
              href="/register?role=merchant"
              className="text-primary-on-tint inline-flex items-center gap-1 font-medium underline-offset-4 hover:underline"
            >
              Sé el primero de tu categoría
              <ArrowRightIcon aria-hidden="true" className="size-3.5" />
            </Link>
          </p>
        ) : null}
      </FadeIn>
    </section>
  )
}

function VerticalTile({ vertical }: { vertical: VerticalSummary }) {
  const available = vertical.count > 0
  const Icon = vertical.icon
  const body = (
    <>
      <span
        aria-hidden="true"
        className={cn(
          'grid size-12 place-items-center rounded-2xl transition-[background-color,color,transform] duration-300 sm:size-14',
          available
            ? 'from-primary/12 to-accent/18 text-primary-on-tint group-hover:bg-primary group-hover:text-primary-foreground bg-gradient-to-br group-hover:scale-105 group-hover:from-transparent group-hover:to-transparent'
            : 'bg-muted text-muted-foreground',
        )}
      >
        <Icon className="size-6 sm:size-7" strokeWidth={1.6} />
      </span>
      <span className="w-full truncate text-center text-[11px] font-medium tracking-tight sm:text-sm sm:tracking-normal">
        {vertical.label}
      </span>
      <span
        className={cn(
          'text-[10px] tabular-nums sm:text-xs',
          available ? 'text-muted-foreground' : 'text-primary-on-tint',
        )}
      >
        {available
          ? `${vertical.count} ${vertical.count === 1 ? 'negocio' : 'negocios'}`
          : 'Muy pronto'}
      </span>
    </>
  )

  const tile =
    'rounded-card flex h-full flex-col items-center gap-1.5 px-0.5 py-3 sm:px-1 sm:py-4'

  if (!available) {
    return (
      <div className={cn(tile, 'bg-card/60 ring-foreground/5 ring-1')}>
        {body}
      </div>
    )
  }

  const href = vertical.category
    ? `/?categoria=${encodeURIComponent(vertical.category)}#restaurantes`
    : '/#restaurantes'

  return (
    <Link
      href={href}
      className={cn(
        tile,
        'group bg-card shadow-1 hover:shadow-2 ring-foreground/5 ring-1 transition-[box-shadow,transform] duration-300 hover:-translate-y-0.5 active:scale-[0.97]',
      )}
    >
      {body}
    </Link>
  )
}
