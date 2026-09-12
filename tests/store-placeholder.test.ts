import { describe, expect, it } from 'vitest'
import {
  buildPlaceholder,
  hashSeed,
  placeholderDataUri,
  placeholderSvg,
  PLACEHOLDER_VARIANTS,
} from '@/lib/store/placeholder'

describe('hashSeed', () => {
  it('is deterministic', () => {
    expect(hashSeed('arepa-and-co')).toBe(hashSeed('arepa-and-co'))
  })

  it('is always a non-negative 32 bit integer', () => {
    for (const seed of ['', 'a', 'arepa-and-co', '¿ñ?', '🍔🍟']) {
      const value = hashSeed(seed)
      expect(Number.isInteger(value)).toBe(true)
      expect(value).toBeGreaterThanOrEqual(0)
      expect(value).toBeLessThan(2 ** 32)
    }
  })

  it('separates near-identical seeds', () => {
    expect(hashSeed('store-1')).not.toBe(hashSeed('store-2'))
  })
})

describe('buildPlaceholder', () => {
  it('returns the exact same pattern for the same input', () => {
    const a = buildPlaceholder('arepa-and-co', '#DC2626', 'Arepa & Co')
    const b = buildPlaceholder('arepa-and-co', '#DC2626', 'Arepa & Co')
    expect(a).toEqual(b)
  })

  it('returns a different pattern for a different seed', () => {
    const a = buildPlaceholder('arepa-and-co', '#DC2626', 'Arepa & Co')
    const b = buildPlaceholder('la-parrilla-del-norte', '#DC2626', 'Arepa & Co')
    expect(a).not.toEqual(b)
  })

  it('picks a variant from the published list', () => {
    for (const seed of ['a', 'b', 'c', 'd', 'e', 'f', 'g', 'h']) {
      const pattern = buildPlaceholder(seed, '#C2410C', 'Test')
      expect(PLACEHOLDER_VARIANTS).toContain(pattern.variant)
    }
  })

  it('keeps every shape inside the 0..100 viewBox', () => {
    for (const seed of ['a', 'b', 'c', 'd', 'e', 'f', 'g', 'h']) {
      const { shapes } = buildPlaceholder(seed, '#C2410C', 'Test')
      expect(shapes.length).toBeGreaterThan(2)
      expect(shapes.length).toBeLessThanOrEqual(40)
      for (const shape of shapes) {
        expect(shape.x).toBeGreaterThanOrEqual(-40)
        expect(shape.x).toBeLessThanOrEqual(140)
        expect(shape.y).toBeGreaterThanOrEqual(-40)
        expect(shape.y).toBeLessThanOrEqual(140)
        expect(shape.size).toBeGreaterThan(0)
        expect(shape.opacity).toBeGreaterThan(0)
        expect(shape.opacity).toBeLessThanOrEqual(1)
      }
    }
  })

  it('derives the initials from the label', () => {
    expect(buildPlaceholder('s', '#C2410C', 'Arepa & Co').initial).toBe('AC')
    expect(buildPlaceholder('s', '#C2410C', 'Burger').initial).toBe('B')
    expect(buildPlaceholder('s', '#C2410C', '   ').initial).toBe('?')
  })

  it('derives readable colours from the primary and never throws', () => {
    const pattern = buildPlaceholder('s', 'not-a-color', 'X')
    expect(pattern.background).toMatch(/^#[0-9a-f]{6}$/)
    expect(pattern.foreground).toMatch(/^#[0-9a-f]{6}$/)
    expect(pattern.ink).toMatch(/^#[0-9a-f]{6}$/)
  })

  it('accepts a hex without the leading hash and short hex', () => {
    expect(buildPlaceholder('s', 'DC2626', 'X')).toEqual(
      buildPlaceholder('s', '#dc2626', 'X'),
    )
    expect(buildPlaceholder('s', '#f00', 'X')).toEqual(
      buildPlaceholder('s', '#ff0000', 'X'),
    )
  })
})

describe('placeholderSvg', () => {
  it('renders a standalone svg carrying the initials', () => {
    const svg = placeholderSvg(buildPlaceholder('s', '#C2410C', 'Arepa & Co'))
    expect(svg.startsWith('<svg')).toBe(true)
    expect(svg).toContain('AC')
    expect(svg).toContain('viewBox="0 0 100 100"')
  })

  it('escapes the initials so a label can never inject markup', () => {
    const svg = placeholderSvg(buildPlaceholder('s', '#C2410C', '<script> &'))
    expect(svg).not.toContain('<script')
  })

  it('is deterministic', () => {
    const a = placeholderSvg(buildPlaceholder('x', '#C2410C', 'Y'))
    const b = placeholderSvg(buildPlaceholder('x', '#C2410C', 'Y'))
    expect(a).toBe(b)
  })
})

describe('placeholderDataUri', () => {
  it('produces an inline svg data uri', () => {
    const uri = placeholderDataUri('s', '#C2410C', 'Arepa & Co')
    expect(uri.startsWith('data:image/svg+xml,')).toBe(true)
    expect(uri).toBe(placeholderDataUri('s', '#C2410C', 'Arepa & Co'))
  })
})
