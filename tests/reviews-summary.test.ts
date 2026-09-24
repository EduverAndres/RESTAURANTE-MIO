import { describe, expect, it } from 'vitest'
import { ratingLabel, reviewsSectionMode } from '@/lib/store/reviews-summary'

describe('reviewsSectionMode', () => {
  it('lists the reviews when at least one has a comment', () => {
    expect(reviewsSectionMode({ commented: 2, ratingCount: 5 })).toBe('list')
  })

  it('summarises star-only ratings instead of claiming there are none', () => {
    expect(reviewsSectionMode({ commented: 0, ratingCount: 3 })).toBe('summary')
  })

  it('is empty only when nobody rated the store', () => {
    expect(reviewsSectionMode({ commented: 0, ratingCount: 0 })).toBe('empty')
  })

  it('treats a missing rating count as zero', () => {
    expect(reviewsSectionMode({ commented: 0, ratingCount: null })).toBe(
      'empty',
    )
    expect(reviewsSectionMode({ commented: 0, ratingCount: undefined })).toBe(
      'empty',
    )
  })

  it('never reports a summary for a negative or fractional count', () => {
    expect(reviewsSectionMode({ commented: 0, ratingCount: -1 })).toBe('empty')
    expect(reviewsSectionMode({ commented: 0, ratingCount: 0.4 })).toBe('empty')
  })
})

describe('ratingLabel', () => {
  it('formats the average with a comma and pluralises the count', () => {
    expect(ratingLabel(4.5, 3)).toBe('4,5 de 5 según 3 opiniones')
  })

  it('uses the singular for a single opinion', () => {
    expect(ratingLabel(5, 1)).toBe('5,0 de 5 según 1 opinión')
  })

  it('rounds the average to one decimal', () => {
    expect(ratingLabel(4.26, 12)).toBe('4,3 de 5 según 12 opiniones')
  })

  it('accepts the numeric string Postgres returns for a numeric column', () => {
    expect(ratingLabel('3.75', 2)).toBe('3,8 de 5 según 2 opiniones')
  })

  it('falls back to zero when the average is missing', () => {
    expect(ratingLabel(null, 0)).toBe('0,0 de 5 según 0 opiniones')
  })
})
