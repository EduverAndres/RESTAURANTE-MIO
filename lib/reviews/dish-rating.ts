// How a dish's rating is shown. Pure, so the threshold and the wording are
// tested once and every surface (card, drawer) says the same thing.

/**
 * Below this many visible ratings nothing is shown — not even "sin
 * calificaciones". One or two votes say more about the voters than about the
 * dish, and an empty state on every new dish would read as a warning.
 */
export const DISH_RATING_MIN_COUNT = 3

/** Longest comment a dish review may carry (also a CHECK in the database). */
export const DISH_COMMENT_MAX = 300

export interface DishRatingBadge {
  /** "★ 4,6 (23)" */
  text: string
  /** "4,6 de 5 estrellas, 23 calificaciones" */
  label: string
  average: number
  count: number
}

const ONE_DECIMAL = new Intl.NumberFormat('es-CO', {
  minimumFractionDigits: 1,
  maximumFractionDigits: 1,
})

export function dishRatingBadge(
  average: number | string | null | undefined,
  count: number | null | undefined,
): DishRatingBadge | null {
  const total = Number(count ?? 0)
  const mean = Number(average ?? 0)
  if (!Number.isFinite(total) || total < DISH_RATING_MIN_COUNT) return null
  if (!Number.isFinite(mean) || mean <= 0) return null
  const shown = ONE_DECIMAL.format(Math.min(5, mean))
  return {
    text: `★ ${shown} (${total})`,
    label: `${shown} de 5 estrellas, ${total} ${total === 1 ? 'calificación' : 'calificaciones'}`,
    average: mean,
    count: total,
  }
}

/**
 * The first name only, for anything shown publicly (Ley 1581: the minimum
 * needed to make a review feel human; never the surname, email or phone).
 */
export function firstNameOnly(
  fullName: string | null | undefined,
): string | null {
  const first = fullName?.trim().split(/\s+/)[0] ?? ''
  return first ? first.slice(0, 40) : null
}
