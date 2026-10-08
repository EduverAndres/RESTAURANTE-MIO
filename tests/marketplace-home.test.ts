import { describe, expect, it } from 'vitest'
import {
  FAST_ETA_MIN,
  POPULAR_MIN_RATINGS,
  primaryHighlight,
  type HighlightInput,
} from '@/lib/marketplace/highlights'
import {
  PROOF_THRESHOLDS,
  isTestimonial,
  visibleStats,
} from '@/lib/marketplace/social-proof'
import { summarizeVerticals, verticalOf } from '@/lib/marketplace/verticals'

const base: HighlightInput = {
  is_open: true,
  rating_avg: 4,
  rating_count: 3,
  delivery_fee: 5000,
  prep_time_min: 40,
  eta_min: null,
}

describe('primaryHighlight', () => {
  it('needs enough well-rated reviews before calling a store popular', () => {
    expect(
      primaryHighlight({ ...base, rating_avg: 5, rating_count: 1 }),
    ).toBeNull()
    expect(
      primaryHighlight({
        ...base,
        rating_avg: 4.8,
        rating_count: POPULAR_MIN_RATINGS,
      }),
    ).toBe('popular')
  })

  it('marks an open store under the ETA threshold as fast, never a closed one', () => {
    const fast = { ...base, eta_min: FAST_ETA_MIN }
    expect(primaryHighlight(fast)).toBe('fast')
    expect(primaryHighlight({ ...fast, is_open: false })).toBeNull()
  })

  it('calls an unrated store new instead of showing a zero rating', () => {
    expect(primaryHighlight({ ...base, rating_count: 0 })).toBe('new')
  })
})

describe('verticals', () => {
  it('files food under restaurants and known categories under their shelf', () => {
    expect(verticalOf('Italiana')).toBe('restaurantes')
    expect(verticalOf(null)).toBe('restaurantes')
    expect(verticalOf('Café y panadería')).toBe('panaderia')
    expect(verticalOf('Droguería')).toBe('farmacia')
  })

  it('counts real stores only and exposes a filter for single-category shelves', () => {
    const summary = summarizeVerticals([
      { category: 'Italiana' },
      { category: 'Japonesa' },
      { category: 'Café y panadería' },
    ])
    const byKey = Object.fromEntries(summary.map((item) => [item.key, item]))
    expect(byKey.restaurantes.count).toBe(2)
    expect(byKey.restaurantes.category).toBeNull()
    expect(byKey.panaderia).toMatchObject({
      count: 1,
      category: 'Café y panadería',
    })
    expect(byKey.farmacia.count).toBe(0)
    expect(summary).toHaveLength(8)
  })
})

describe('social proof', () => {
  it('hides every figure that has not reached its floor', () => {
    expect(
      visibleStats({
        stores: PROOF_THRESHOLDS.stores - 1,
        reviews: PROOF_THRESHOLDS.reviews - 1,
        ratingAverage: 4.9,
        deliveredOrders: PROOF_THRESHOLDS.deliveredOrders - 1,
      }),
    ).toEqual([])
  })

  it('shows the figures that cleared it, in order', () => {
    const stats = visibleStats({
      stores: PROOF_THRESHOLDS.stores,
      reviews: PROOF_THRESHOLDS.reviews,
      ratingAverage: 4.6,
      deliveredOrders: null,
    })
    expect(stats.map((stat) => stat.key)).toEqual(['stores', 'rating'])
  })

  it('only quotes good reviews that actually say something', () => {
    expect(
      isTestimonial({
        rating: 5,
        comment: 'Excelente servicio, llegó caliente.',
      }),
    ).toBe(true)
    expect(isTestimonial({ rating: 5, comment: 'Ok' })).toBe(false)
    expect(
      isTestimonial({ rating: 3, comment: 'Llegó tarde pero estaba rico.' }),
    ).toBe(false)
    expect(isTestimonial({ rating: 5, comment: null })).toBe(false)
  })
})
