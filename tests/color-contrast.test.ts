import { describe, expect, it } from 'vitest'
import { contrastRatio, relativeLuminance } from '@/lib/color/contrast'

describe('relativeLuminance', () => {
  it('returns 1 for white and 0 for black', () => {
    expect(relativeLuminance('#ffffff')).toBeCloseTo(1, 6)
    expect(relativeLuminance('#000000')).toBeCloseTo(0, 6)
  })

  it('expands 3-digit hex and tolerates a missing hash', () => {
    expect(relativeLuminance('#fff')).toBeCloseTo(1, 6)
    expect(relativeLuminance('ffffff')).toBeCloseTo(1, 6)
  })

  it('matches the WCAG reference value for mid grey', () => {
    // #808080 -> sRGB 0.5020 -> linear 0.2159
    expect(relativeLuminance('#808080')).toBeCloseTo(0.2159, 3)
  })

  it('throws on invalid input', () => {
    expect(() => relativeLuminance('#12')).toThrow()
    expect(() => relativeLuminance('red')).toThrow()
  })
})

describe('contrastRatio', () => {
  it('is 21:1 for black on white and symmetric', () => {
    expect(contrastRatio('#000000', '#ffffff')).toBeCloseTo(21, 6)
    expect(contrastRatio('#ffffff', '#000000')).toBeCloseTo(21, 6)
  })

  it('is 1:1 for identical colors', () => {
    expect(contrastRatio('#c2410c', '#c2410c')).toBeCloseTo(1, 6)
  })

  it('matches a known WCAG pair', () => {
    // #767676 on white is the canonical "just passes AA" grey (4.54:1).
    expect(contrastRatio('#767676', '#ffffff')).toBeCloseTo(4.54, 2)
  })
})
