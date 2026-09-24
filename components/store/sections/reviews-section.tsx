import { ExpandableText } from '@/components/store/expandable-text'
import { PlaceholderImage } from '@/components/store/placeholder-image'
import { SectionShell } from '@/components/store/sections/section-shell'
import { StarRating } from '@/components/store/star-rating'
import { StoreEmptyState } from '@/components/store/store-empty-state'
import type { StoreSectionProps } from '@/components/store/storefront-context'
import { initialsOf } from '@/lib/format'
import { fetchReviews } from '@/lib/store/data'
import {
  formatAverage,
  opinionCount,
  ratingLabel,
  reviewsSectionMode,
} from '@/lib/store/reviews-summary'

const dateFormatter = new Intl.DateTimeFormat('es-CO', {
  day: 'numeric',
  month: 'long',
  year: 'numeric',
})

/**
 * What other people said. Names are only visible to viewers allowed to see
 * them (`profiles` is not public), so an anonymous visitor sees "Cliente" and
 * an avatar built from the review's own id — never a blank circle.
 *
 * Only reviews with a comment are listed; when every rating is star-only the
 * section shows the average instead of claiming nobody has an opinion yet.
 */
export async function ReviewsSection({ context }: StoreSectionProps) {
  const { store, theme } = context
  const reviews = await fetchReviews(store.id)
  const ratingCount = store.rating_count ?? 0
  const mode = reviewsSectionMode({
    commented: reviews.length,
    ratingCount,
  })

  return (
    <SectionShell
      id="opiniones"
      title="Lo que dicen"
      description={
        mode === 'empty'
          ? undefined
          : `${ratingLabel(store.rating_avg, ratingCount)}.`
      }
    >
      {mode === 'empty' ? (
        <StoreEmptyState
          title="Todavía no hay opiniones"
          description="Sé la primera persona en contar cómo estuvo tu pedido."
        />
      ) : mode === 'summary' ? (
        <div className="store-card flex flex-col items-center gap-2 p-[var(--store-density-padding)] text-center shadow-[var(--store-card-shadow)] [border:var(--store-card-border)]">
          <p className="store-heading text-display text-[var(--store-text)]">
            {formatAverage(store.rating_avg)}
          </p>
          <StarRating value={Number(store.rating_avg)} size="md" />
          <p className="text-sm text-[rgb(var(--store-text-rgb)/0.78)]">
            {opinionCount(ratingCount)} con estrellas, todavía sin comentarios.
          </p>
        </div>
      ) : (
        <ul className="gap-card grid sm:grid-cols-2 lg:grid-cols-3">
          {reviews.map((review) => {
            const name = review.authorName ?? 'Cliente'
            return (
              <li
                key={review.id}
                className="store-card flex flex-col gap-3 p-[var(--store-density-padding)] shadow-[var(--store-card-shadow)] [border:var(--store-card-border)]"
              >
                <div className="flex items-center gap-3">
                  <span className="relative size-10 shrink-0 overflow-hidden rounded-full">
                    <PlaceholderImage
                      seed={review.id}
                      color={theme.primary}
                      label={name}
                      initialScale={1.1}
                    />
                    <span className="sr-only">{initialsOf(name)}</span>
                  </span>
                  <div className="min-w-0">
                    <p className="truncate text-sm font-semibold">{name}</p>
                    <time
                      dateTime={review.created_at}
                      className="text-xs text-[rgb(var(--store-text-rgb)/0.75)]"
                    >
                      {dateFormatter.format(new Date(review.created_at))}
                    </time>
                  </div>
                </div>

                <StarRating value={Number(review.rating)} />

                {review.comment ? (
                  <ExpandableText
                    text={review.comment}
                    className="text-sm text-[rgb(var(--store-text-rgb)/0.78)]"
                  />
                ) : null}
              </li>
            )
          })}
        </ul>
      )}
    </SectionShell>
  )
}
