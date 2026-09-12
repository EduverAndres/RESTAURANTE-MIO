import { BikeIcon, ClockIcon, MapPinIcon, StarIcon } from 'lucide-react'
import type { StorefrontContext } from '@/components/store/storefront-context'
import { formatCOP } from '@/lib/format'
import { formatDistance } from '@/lib/geo'
import { cn } from '@/lib/utils'

interface StatusChipsProps {
  context: StorefrontContext
  /**
   * `image` sits on top of a photo or a dark gradient, `surface` on the
   * storefront background. Only the chip skin changes.
   */
  tone?: 'image' | 'surface'
  className?: string
}

function chipClass(tone: 'image' | 'surface'): string {
  return cn(
    'inline-flex items-center gap-1.5 rounded-pill px-3 py-1 text-sm font-medium whitespace-nowrap',
    tone === 'image'
      ? 'bg-black/45 text-white backdrop-blur-sm'
      : 'bg-[rgb(var(--store-text-rgb)/0.06)] text-[var(--store-text)]',
  )
}

/**
 * The facts a visitor decides on: open or closed, how long, how far, how good.
 *
 * The open/closed chip is `aria-live="polite"` because it is the one value
 * that can change while the page is open (a store closing at 22:00), and a
 * screen reader user should hear it without re-reading the hero.
 */
export function StatusChips({
  context,
  tone = 'surface',
  className,
}: StatusChipsProps) {
  const { store, theme, hours, distanceKm } = context
  const chip = chipClass(tone)
  const closing = hours.open && hours.closesInMin !== null

  return (
    <ul className={cn('flex flex-wrap items-center gap-2', className)}>
      <li>
        <span
          aria-live="polite"
          className={cn(
            chip,
            hours.open
              ? closing
                ? 'bg-amber-500/90 text-black'
                : 'bg-emerald-600/90 text-white'
              : tone === 'image'
                ? 'bg-black/60 text-white'
                : 'bg-[rgb(var(--store-text-rgb)/0.1)]',
          )}
        >
          <span
            aria-hidden="true"
            className={cn(
              'size-2 rounded-full',
              hours.open ? 'bg-white' : 'bg-current opacity-60',
            )}
          />
          {hours.label}
        </span>
      </li>

      {theme.hero.showEta ? (
        <li>
          <span className={chip}>
            <ClockIcon aria-hidden="true" className="size-3.5" />
            {store.prep_time_min ?? 20} min
          </span>
        </li>
      ) : null}

      {distanceKm !== null ? (
        <li>
          <span className={chip}>
            <MapPinIcon aria-hidden="true" className="size-3.5" />
            {formatDistance(distanceKm)}
          </span>
        </li>
      ) : null}

      {theme.hero.showRating && (store.rating_count ?? 0) > 0 ? (
        <li>
          {/*
            A plain <span> may not carry aria-label (ARIA forbids naming a
            role-less element, and axe flags it), so the readable sentence is
            real text, visually hidden, next to the glyphs it replaces.
          */}
          <span className={chip}>
            <StarIcon
              aria-hidden="true"
              className="size-3.5 fill-current text-[var(--store-accent)]"
            />
            <span className="sr-only">
              Valoración {Number(store.rating_avg ?? 0).toFixed(1)} sobre 5,{' '}
              {store.rating_count} opiniones
            </span>
            <span aria-hidden="true">
              {Number(store.rating_avg ?? 0).toFixed(1)} ({store.rating_count})
            </span>
          </span>
        </li>
      ) : null}

      <li>
        <span className={chip}>
          <BikeIcon aria-hidden="true" className="size-3.5" />
          {Number(store.delivery_fee ?? 0) === 0
            ? 'Envío gratis'
            : formatCOP(Number(store.delivery_fee))}
        </span>
      </li>
    </ul>
  )
}
