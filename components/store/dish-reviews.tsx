'use client'

import { useEffect, useState } from 'react'
import { getDishReviews, type DishReview } from '@/app/(public)/actions'
import { StarRating } from '@/components/store/star-rating'
import { dishRatingBadge } from '@/lib/reviews/dish-rating'

const DATE = new Intl.DateTimeFormat('es-CO', {
  day: 'numeric',
  month: 'short',
})

/**
 * The latest comments on a dish, inside its detail. Fetched when the detail
 * opens (never with the menu) and only for a dish that already shows a
 * rating badge: below the threshold nothing about ratings is shown at all.
 */
export function DishReviews({
  productId,
  average,
  count,
}: {
  productId: string
  average: number | string | null | undefined
  count: number | null | undefined
}) {
  const badge = dishRatingBadge(average, count)
  const [reviews, setReviews] = useState<DishReview[] | null>(null)

  useEffect(() => {
    if (!badge) return
    let cancelled = false
    setReviews(null)
    void getDishReviews(productId)
      .then((rows) => {
        if (!cancelled) setReviews(rows)
      })
      .catch(() => {
        if (!cancelled) setReviews([])
      })
    return () => {
      cancelled = true
    }
    // `badge` is derived from average/count, which are the real inputs.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [productId, average, count])

  if (!badge || !reviews || reviews.length === 0) return null

  return (
    <section
      aria-labelledby={`dish-reviews-${productId}`}
      className="space-y-3"
    >
      <h3
        id={`dish-reviews-${productId}`}
        className="flex items-center gap-2 text-sm font-semibold"
      >
        Lo que dicen de este plato
        <span className="text-xs font-medium text-[rgb(var(--store-text-rgb)/0.6)] tabular-nums">
          {badge.text}
        </span>
      </h3>
      <ul className="space-y-3">
        {reviews.map((review) => (
          <li
            key={review.id}
            className="rounded-[var(--store-field-radius)] bg-[rgb(var(--store-text-rgb)/0.04)] px-3 py-2.5"
          >
            <div className="flex items-center justify-between gap-2 text-xs text-[rgb(var(--store-text-rgb)/0.65)]">
              <span className="flex items-center gap-2">
                <StarRating value={review.rating} />
                <span className="font-medium text-[rgb(var(--store-text-rgb)/0.85)]">
                  {review.authorFirstName ?? 'Cliente'}
                </span>
              </span>
              <time dateTime={review.createdAt}>
                {DATE.format(new Date(review.createdAt))}
              </time>
            </div>
            <p className="mt-1 text-sm text-pretty">{review.comment}</p>
          </li>
        ))}
      </ul>
    </section>
  )
}
