// The reviews section has three honest shapes, decided here so the component
// only renders. `fetchReviews` returns the reviews that have a comment, while
// `stores.rating_count` counts every rating, so "no reviews to list" and "no
// ratings at all" are different facts and must read differently.

export type ReviewsSectionMode = 'list' | 'summary' | 'empty'

interface ReviewsSectionInput {
  /** Reviews with a comment, the ones the section can actually list. */
  commented: number
  /** Every rating the store received, commented or star-only. */
  ratingCount: number | null | undefined
}

/**
 * `list` when there is at least one comment to show, `summary` when people
 * rated the store but nobody wrote anything yet, `empty` when nobody rated.
 */
export function reviewsSectionMode({
  commented,
  ratingCount,
}: ReviewsSectionInput): ReviewsSectionMode {
  if (commented > 0) return 'list'
  return (ratingCount ?? 0) >= 1 ? 'summary' : 'empty'
}

/** `4,5` — one decimal, es-CO comma, tolerant of Postgres numeric strings. */
export function formatAverage(avg: number | string | null | undefined): string {
  const value = Number(avg ?? 0)
  return (Number.isFinite(value) ? value : 0).toFixed(1).replace('.', ',')
}

/** `3 opiniones`, `1 opinión`. */
export function opinionCount(count: number): string {
  return `${count} ${count === 1 ? 'opinión' : 'opiniones'}`
}

/** `4,5 de 5 según 3 opiniones` — the line under the section title. */
export function ratingLabel(
  avg: number | string | null | undefined,
  count: number,
): string {
  return `${formatAverage(avg)} de 5 según ${opinionCount(count)}`
}
