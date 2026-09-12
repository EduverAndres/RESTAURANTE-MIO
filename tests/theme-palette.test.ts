import { describe, expect, it } from 'vitest'
import { contrastRatio } from '@/lib/color/contrast'
import { hexToOklch } from '@/lib/theme/oklch'
import { PALETTE_KINDS, generatePalettes } from '@/lib/theme/palette'

const HEX = /^#[0-9a-f]{6}$/

/** Shortest angular distance between two hues, in degrees (0..180). */
function hueDistance(a: number, b: number): number {
  return Math.abs(((((a - b + 180) % 360) + 360) % 360) - 180)
}

describe('generatePalettes', () => {
  it('returns one suggestion per harmony, in a stable order', () => {
    const palettes = generatePalettes('#c2410c', 'light')
    expect(palettes.map((p) => p.kind)).toEqual([...PALETTE_KINDS])
  })

  it('is deterministic for the same input', () => {
    expect(generatePalettes('#c2410c', 'light')).toEqual(
      generatePalettes('#c2410c', 'light'),
    )
  })

  it('keeps the merchant primary exactly as given', () => {
    for (const palette of generatePalettes('#C2410C', 'light')) {
      expect(palette.colors.primary).toBe('#c2410c')
    }
  })

  it('emits canonical hex for every colour', () => {
    for (const palette of generatePalettes('#0aa3ff', 'dark')) {
      for (const value of Object.values(palette.colors)) {
        expect(value).toMatch(HEX)
      }
      expect(palette.onPrimary).toMatch(HEX)
    }
  })

  it('puts the complementary secondary roughly opposite the primary', () => {
    const [complementary] = generatePalettes('#c2410c', 'light')
    const primaryHue = hexToOklch('#c2410c').h
    const secondaryHue = hexToOklch(complementary.colors.secondary).h
    expect(hueDistance(secondaryHue, primaryHue)).toBeGreaterThan(140)
  })

  it('keeps the analogous neighbours close to the primary hue', () => {
    const analogous = generatePalettes('#c2410c', 'light')[1]
    const primaryHue = hexToOklch('#c2410c').h
    for (const key of ['secondary', 'accent'] as const) {
      const hue = hexToOklch(analogous.colors[key]).h
      expect(hueDistance(hue, primaryHue)).toBeLessThan(70)
    }
  })

  it('keeps the monochromatic palette on a single hue', () => {
    const mono = generatePalettes('#0aa3ff', 'light')[2]
    const primaryHue = hexToOklch('#0aa3ff').h
    for (const key of ['secondary', 'accent'] as const) {
      expect(
        hueDistance(hexToOklch(mono.colors[key]).h, primaryHue),
      ).toBeLessThan(12)
    }
  })

  it('reports the contrast ratios it claims', () => {
    for (const palette of generatePalettes('#7c2d12', 'light')) {
      const { colors, contrast } = palette
      expect(contrast.textOnBackground).toBeCloseTo(
        contrastRatio(colors.text, colors.background),
        2,
      )
      expect(contrast.textOnSurface).toBeCloseTo(
        contrastRatio(colors.text, colors.surface),
        2,
      )
      expect(contrast.onPrimary).toBeCloseTo(
        contrastRatio(palette.onPrimary, colors.primary),
        2,
      )
    }
  })

  it('marks a palette as AA only when every reported pair clears 4.5:1', () => {
    for (const palette of generatePalettes('#f59e0b', 'light')) {
      const values = Object.values(palette.contrast)
      expect(palette.passesAA).toBe(values.every((ratio) => ratio >= 4.5))
    }
  })

  it('produces readable text on background for a light and a dark mode', () => {
    for (const mode of ['light', 'dark'] as const) {
      for (const palette of generatePalettes('#c2410c', mode)) {
        expect(palette.contrast.textOnBackground).toBeGreaterThanOrEqual(4.5)
        expect(palette.contrast.textOnSurface).toBeGreaterThanOrEqual(4.5)
      }
    }
  })

  it('darkens the background for dark mode and lightens it for light mode', () => {
    const light = generatePalettes('#c2410c', 'light')[0]
    const dark = generatePalettes('#c2410c', 'dark')[0]
    expect(hexToOklch(light.colors.background).l).toBeGreaterThan(0.8)
    expect(hexToOklch(dark.colors.background).l).toBeLessThan(0.3)
  })

  it('carries a Spanish label and description', () => {
    for (const palette of generatePalettes('#c2410c', 'light')) {
      expect(palette.label.length).toBeGreaterThan(2)
      expect(palette.description.length).toBeGreaterThan(10)
    }
  })

  it('falls back to the default primary when the input is not a colour', () => {
    const palettes = generatePalettes('nope', 'light')
    expect(palettes).toHaveLength(PALETTE_KINDS.length)
    expect(palettes[0].colors.primary).toMatch(HEX)
  })

  it('survives a greyscale primary without producing NaN hues', () => {
    for (const palette of generatePalettes('#808080', 'light')) {
      for (const value of Object.values(palette.colors)) {
        expect(value).toMatch(HEX)
      }
    }
  })
})
