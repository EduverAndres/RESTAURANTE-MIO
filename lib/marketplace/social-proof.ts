/**
 * Social proof for the home, from real rows only.
 *
 * A number is only worth showing once it helps: "3 pedidos entregados" costs
 * more trust than it earns. Each figure therefore has a floor, and below it
 * the figure is simply left out — the section grows on its own as the
 * platform does, with nobody editing copy. Testimonials are real reviews
 * with a comment, attributed to the store (customer names are private, see
 * `ReviewsSection`), never paraphrased.
 */

export const PROOF_THRESHOLDS = {
  stores: 5,
  reviews: 10,
  deliveredOrders: 100,
} as const

/** A testimonial has to say something and has to be a good experience. */
export const TESTIMONIAL_MIN_RATING = 4
export const TESTIMONIAL_MIN_LENGTH = 15

export interface ProofCounts {
  stores: number
  reviews: number
  ratingAverage: number | null
  deliveredOrders: number | null
}

export type ProofStat =
  | { key: 'stores'; value: number }
  | { key: 'rating'; value: number; reviews: number }
  | { key: 'delivered'; value: number }

/** The stats that clear their floor, in display order. */
export function visibleStats(counts: ProofCounts): ProofStat[] {
  const stats: ProofStat[] = []
  if (counts.stores >= PROOF_THRESHOLDS.stores) {
    stats.push({ key: 'stores', value: counts.stores })
  }
  if (
    counts.ratingAverage !== null &&
    counts.reviews >= PROOF_THRESHOLDS.reviews
  ) {
    stats.push({
      key: 'rating',
      value: counts.ratingAverage,
      reviews: counts.reviews,
    })
  }
  if (
    counts.deliveredOrders !== null &&
    counts.deliveredOrders >= PROOF_THRESHOLDS.deliveredOrders
  ) {
    stats.push({ key: 'delivered', value: counts.deliveredOrders })
  }
  return stats
}

export function isTestimonial(review: {
  rating: number
  comment: string | null
}): boolean {
  return (
    review.rating >= TESTIMONIAL_MIN_RATING &&
    (review.comment?.trim().length ?? 0) >= TESTIMONIAL_MIN_LENGTH
  )
}
