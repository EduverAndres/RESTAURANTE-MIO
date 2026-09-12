import { describe, expect, it } from 'vitest'
import { SLUG_PATTERN, isValidSlug, slugify } from '@/lib/slug'

describe('slugify', () => {
  it('lowercases and replaces spaces with hyphens', () => {
    expect(slugify('La Parrilla del Norte')).toBe('la-parrilla-del-norte')
  })

  it('strips diacritics', () => {
    expect(slugify('Pizzería Ragazzi')).toBe('pizzeria-ragazzi')
    expect(slugify('Café Lumbre')).toBe('cafe-lumbre')
  })

  it('replaces symbols and collapses repeated separators', () => {
    expect(slugify('Arepa & Co')).toBe('arepa-co')
    expect(slugify('Sushi   ---  Nocturno!!')).toBe('sushi-nocturno')
  })

  it('trims leading and trailing separators', () => {
    expect(slugify('  --verde bowl--  ')).toBe('verde-bowl')
  })

  it('returns an empty string when nothing usable remains', () => {
    expect(slugify('***')).toBe('')
    expect(slugify('')).toBe('')
  })

  it('always produces output that matches the database slug constraint', () => {
    const inputs = ['Ñandú Grill', 'Tienda #1 (Centro)', 'ÀÉÎÕÜ', 'x_y.z']
    for (const input of inputs) {
      expect(slugify(input)).toMatch(SLUG_PATTERN)
    }
  })
})

describe('isValidSlug', () => {
  it('accepts lowercase alphanumerics separated by single hyphens', () => {
    expect(isValidSlug('cafe-lumbre')).toBe(true)
    expect(isValidSlug('store123')).toBe(true)
  })

  it('rejects uppercase, leading/trailing or doubled hyphens and symbols', () => {
    expect(isValidSlug('Cafe-Lumbre')).toBe(false)
    expect(isValidSlug('-cafe')).toBe(false)
    expect(isValidSlug('cafe-')).toBe(false)
    expect(isValidSlug('cafe--lumbre')).toBe(false)
    expect(isValidSlug('cafe_lumbre')).toBe(false)
    expect(isValidSlug('')).toBe(false)
  })
})
