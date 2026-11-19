import { dishRatingBadge } from '@/lib/reviews/dish-rating'
import { cn } from '@/lib/utils'

/**
 * "★ 4,6 (23)" for a dish with enough ratings, nothing at all otherwise (see
 * DISH_RATING_MIN_COUNT). Reads the aggregate columns that come with the
 * menu, so it costs no query. Painted with the store's own tokens.
 */
export function DishRatingBadge({
  average,
  count,
  className,
}: {
  average: number | string | null | undefined
  count: number | null | undefined
  className?: string
}) {
  const badge = dishRatingBadge(average, count)
  if (!badge) return null
  return (
    <p
      className={cn(
        'inline-flex items-center gap-1 text-xs font-semibold text-[rgb(var(--store-text-rgb)/0.75)] tabular-nums',
        className,
      )}
    >
      <span className="sr-only">{badge.label}</span>
      <span aria-hidden="true">
        <span className="text-[var(--store-primary)]">★</span>{' '}
        {badge.text.replace(/^★ /, '')}
      </span>
    </p>
  )
}
