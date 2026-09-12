import { describe, expect, it } from 'vitest'
import {
  hexToOklch,
  oklchToHex,
  rotateHue,
  withChroma,
  withLightness,
} from '@/lib/theme/oklch'

const SAMPLES = [
  '#c2410c',
  '#ffffff',
  '#000000',
  '#7c2d12',
  '#f59e0b',
  '#1c1917',
  '#0aa3ff',
  '#fbf8f3',
]

describe('hexToOklch', () => {
  it('maps white to lightness 1 and no chroma', () => {
    const white = hexToOklch('#ffffff')
    expect(white.l).toBeCloseTo(1, 3)
    expect(white.c).toBeCloseTo(0, 3)
  })

  it('maps black to lightness 0', () => {
    const black = hexToOklch('#000000')
    expect(black.l).toBeCloseTo(0, 3)
    expect(black.c).toBeCloseTo(0, 3)
  })

  it('keeps the hue of a warm orange in the orange arc', () => {
    const orange = hexToOklch('#c2410c')
    expect(orange.h).toBeGreaterThan(20)
    expect(orange.h).toBeLessThan(60)
    expect(orange.c).toBeGreaterThan(0.1)
  })

  it('accepts a shorthand hex and a missing hash', () => {
    expect(hexToOklch('#fff').l).toBeCloseTo(1, 3)
    expect(hexToOklch('fff').l).toBeCloseTo(1, 3)
  })

  it('throws on a value that is not a colour', () => {
    expect(() => hexToOklch('not a colour')).toThrow()
  })

  it('reports hue in [0, 360)', () => {
    for (const hex of SAMPLES) {
      const { h } = hexToOklch(hex)
      expect(h).toBeGreaterThanOrEqual(0)
      expect(h).toBeLessThan(360)
    }
  })
})

describe('oklchToHex', () => {
  it('round-trips every sample within one 8-bit step', () => {
    for (const hex of SAMPLES) {
      expect(oklchToHex(hexToOklch(hex))).toBe(hex)
    }
  })

  it('always returns a canonical lowercase six digit hex', () => {
    expect(oklchToHex({ l: 0.5, c: 0.1, h: 200 })).toMatch(/^#[0-9a-f]{6}$/)
  })

  it('maps an out of gamut chroma back into sRGB instead of clipping wildly', () => {
    // 0.4 chroma at this lightness does not exist in sRGB.
    const mapped = oklchToHex({ l: 0.6, c: 0.4, h: 140 })
    expect(mapped).toMatch(/^#[0-9a-f]{6}$/)
    const back = hexToOklch(mapped)
    expect(back.c).toBeLessThan(0.4)
    // The hue must survive the gamut mapping.
    expect(Math.abs(back.h - 140)).toBeLessThan(6)
  })

  it('is deterministic', () => {
    const a = oklchToHex({ l: 0.62, c: 0.21, h: 31 })
    const b = oklchToHex({ l: 0.62, c: 0.21, h: 31 })
    expect(a).toBe(b)
  })

  it('clamps lightness outside 0..1', () => {
    expect(oklchToHex({ l: 2, c: 0, h: 0 })).toBe('#ffffff')
    expect(oklchToHex({ l: -1, c: 0, h: 0 })).toBe('#000000')
  })
})

describe('hue and channel helpers', () => {
  it('rotateHue wraps around 360', () => {
    expect(rotateHue({ l: 0.5, c: 0.1, h: 350 }, 20).h).toBeCloseTo(10, 6)
    expect(rotateHue({ l: 0.5, c: 0.1, h: 10 }, -20).h).toBeCloseTo(350, 6)
    expect(rotateHue({ l: 0.5, c: 0.1, h: 10 }, 720).h).toBeCloseTo(10, 6)
  })

  it('withLightness and withChroma clamp into their range', () => {
    expect(withLightness({ l: 0.5, c: 0.1, h: 10 }, 1.5).l).toBe(1)
    expect(withLightness({ l: 0.5, c: 0.1, h: 10 }, -0.5).l).toBe(0)
    expect(withChroma({ l: 0.5, c: 0.1, h: 10 }, -1).c).toBe(0)
    expect(withChroma({ l: 0.5, c: 0.1, h: 10 }, 0.08).c).toBeCloseTo(0.08, 6)
  })

  it('leaves the other channels untouched', () => {
    const base = { l: 0.5, c: 0.1, h: 10 }
    expect(rotateHue(base, 30)).toMatchObject({ l: 0.5, c: 0.1 })
    expect(withLightness(base, 0.7)).toMatchObject({ c: 0.1, h: 10 })
  })
})
