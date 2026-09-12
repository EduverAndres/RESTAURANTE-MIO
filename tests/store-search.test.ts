import { describe, expect, it } from 'vitest'
import {
  filterMenu,
  foldText,
  highlightMatches,
  productMatches,
} from '@/lib/store/search'

const product = (
  name: string,
  description: string | null = null,
  tags: string[] | null = null,
) => ({ name, description, tags })

describe('foldText', () => {
  it('lowercases and strips diacritics', () => {
    expect(foldText('Café Ñoño')).toBe('cafe nono')
  })

  it('collapses surrounding whitespace', () => {
    expect(foldText('  Arepa   de  queso ')).toBe('arepa de queso')
  })
})

describe('productMatches', () => {
  it('matches the name regardless of accents or case', () => {
    expect(productMatches(product('Café con leche'), 'cafe')).toBe(true)
    expect(productMatches(product('Café con leche'), 'CAFÉ')).toBe(true)
  })

  it('matches the description and the tags', () => {
    expect(productMatches(product('Arepa', 'Con queso costeño'), 'queso')).toBe(
      true,
    )
    expect(productMatches(product('Arepa', null, ['vegano']), 'vegan')).toBe(
      true,
    )
  })

  it('does not match unrelated text', () => {
    expect(productMatches(product('Arepa'), 'pizza')).toBe(false)
  })

  it('matches everything on an empty query', () => {
    expect(productMatches(product('Arepa'), '')).toBe(true)
    expect(productMatches(product('Arepa'), '   ')).toBe(true)
  })
})

describe('highlightMatches', () => {
  it('returns a single plain segment when there is no query', () => {
    expect(highlightMatches('Arepa de queso', '')).toEqual([
      { text: 'Arepa de queso', match: false },
    ])
  })

  it('marks the matching run and keeps the original casing', () => {
    expect(highlightMatches('Café con leche', 'cafe')).toEqual([
      { text: 'Café', match: true },
      { text: ' con leche', match: false },
    ])
  })

  it('marks every occurrence', () => {
    expect(highlightMatches('queso y más queso', 'queso')).toEqual([
      { text: 'queso', match: true },
      { text: ' y más ', match: false },
      { text: 'queso', match: true },
    ])
  })

  it('always reconstructs the original text', () => {
    for (const query of ['', 'e', 'queso', 'zzz', 'Á']) {
      const segments = highlightMatches('Árepa de queso', query)
      expect(segments.map((segment) => segment.text).join('')).toBe(
        'Árepa de queso',
      )
    }
  })

  it('returns a plain segment when nothing matches', () => {
    expect(highlightMatches('Arepa', 'pizza')).toEqual([
      { text: 'Arepa', match: false },
    ])
  })
})

describe('filterMenu', () => {
  const categories = [
    { id: '1', products: [product('Arepa de queso'), product('Empanada')] },
    { id: '2', products: [product('Café')] },
  ]

  it('returns the original categories for an empty query', () => {
    expect(filterMenu(categories, '  ')).toEqual(categories)
  })

  it('keeps only the matching products and drops empty categories', () => {
    const result = filterMenu(categories, 'queso')
    expect(result).toHaveLength(1)
    expect(result[0].id).toBe('1')
    expect(result[0].products.map((item) => item.name)).toEqual([
      'Arepa de queso',
    ])
  })

  it('returns an empty list when nothing matches', () => {
    expect(filterMenu(categories, 'sushi')).toEqual([])
  })

  it('does not mutate the input', () => {
    filterMenu(categories, 'queso')
    expect(categories[0].products).toHaveLength(2)
  })
})
