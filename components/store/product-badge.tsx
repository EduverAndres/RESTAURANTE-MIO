import { cn } from '@/lib/utils'
import type { StoreThemeBadges } from '@/types/app'

export type ProductBadgeKind = 'nuevo' | 'popular'

const DAY_MS = 24 * 60 * 60 * 1000

interface BadgeInput {
  id: string
  created_at: string
}

/**
 * "Nuevo" wins over "Popular": a product can only carry one badge, and the
 * newer fact is the more interesting one. Popularity is the merchant's own
 * signal — the products they put in `featured` — because nothing in the
 * schema counts orders per product.
 */
export function productBadgeOf(
  product: BadgeInput,
  badges: StoreThemeBadges,
  featuredIds: readonly string[],
  now: Date,
): ProductBadgeKind | null {
  if (badges.newDays > 0) {
    const created = Date.parse(product.created_at)
    if (
      Number.isFinite(created) &&
      now.getTime() - created <= badges.newDays * DAY_MS
    ) {
      return 'nuevo'
    }
  }
  if (badges.popularEnabled && featuredIds.includes(product.id))
    return 'popular'
  return null
}

const LABEL: Record<ProductBadgeKind, string> = {
  nuevo: 'Nuevo',
  popular: 'Popular',
}

export function ProductBadge({
  kind,
  style,
  className,
}: {
  kind: ProductBadgeKind
  style: StoreThemeBadges['style']
  className?: string
}) {
  return (
    <span
      className={cn(
        'rounded-pill px-2.5 py-1 text-xs font-semibold tracking-wide',
        style === 'solid' &&
          'bg-[var(--store-primary)] text-[var(--store-on-primary)]',
        // The badge sits on top of a photograph, so even the "soft" style
        // needs an opaque-ish base of its own or it disappears into the image.
        style === 'soft' &&
          'bg-[rgb(var(--store-surface-rgb)/0.92)] text-[var(--store-primary)] ring-1 ring-[rgb(var(--store-primary-rgb)/0.25)] backdrop-blur-sm',
        style === 'outline' &&
          'border border-[var(--store-primary)] bg-[rgb(var(--store-surface-rgb)/0.85)] text-[var(--store-primary)] backdrop-blur-sm',
        className,
      )}
    >
      {LABEL[kind]}
    </span>
  )
}
