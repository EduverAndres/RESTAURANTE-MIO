import { describe, expect, it } from 'vitest'
import {
  DISH_RATING_MIN_COUNT,
  dishRatingBadge,
  firstNameOnly,
} from '@/lib/reviews/dish-rating'

describe('dishRatingBadge', () => {
  it('shows nothing below the threshold, not even an empty state', () => {
    expect(DISH_RATING_MIN_COUNT).toBe(3)
    expect(dishRatingBadge(5, 0)).toBeNull()
    expect(dishRatingBadge(5, 2)).toBeNull()
    expect(dishRatingBadge(null, null)).toBeNull()
  })

  it('formats "★ 4,6 (23)" with a Spanish decimal comma', () => {
    expect(dishRatingBadge('4.63', 23)).toMatchObject({
      text: '★ 4,6 (23)',
      label: '4,6 de 5 estrellas, 23 calificaciones',
    })
    expect(dishRatingBadge(4, 3)?.text).toBe('★ 4,0 (3)')
  })

  it('never shows a broken value', () => {
    expect(dishRatingBadge(0, 10)).toBeNull()
    expect(dishRatingBadge('abc', 10)).toBeNull()
    expect(dishRatingBadge(7, 10)?.text).toBe('★ 5,0 (10)')
  })
})

describe('firstNameOnly', () => {
  it('keeps the first name and drops the rest', () => {
    expect(firstNameOnly('Laura Gómez Pérez')).toBe('Laura')
    expect(firstNameOnly('  Eduver   Gutierrez ')).toBe('Eduver')
  })

  it('returns null when there is no name', () => {
    expect(firstNameOnly('')).toBeNull()
    expect(firstNameOnly('   ')).toBeNull()
    expect(firstNameOnly(null)).toBeNull()
  })
})
