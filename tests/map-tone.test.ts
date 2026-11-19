import { describe, expect, it } from 'vitest'
import {
  contrast,
  luminance,
  mapToneFor,
  mixRgb,
  toneTables,
  type Rgb,
} from '@/lib/map/tone'

// The app's tokens (app/globals.css) for both themes.
const LIGHT = {
  foreground: [0x1c, 0x19, 0x17] as Rgb,
  background: [0xfb, 0xf8, 0xf3] as Rgb,
  primary: [0xc2, 0x41, 0x0c] as Rgb,
}
const DARK = {
  foreground: [0xf3, 0xef, 0xe8] as Rgb,
  background: [0x0e, 0x0d, 0x0b] as Rgb,
  primary: [0xf9, 0x73, 0x16] as Rgb,
}

describe('mapToneFor', () => {
  it('keeps map labels readable on the map paper in both themes', () => {
    for (const theme of [LIGHT, DARK]) {
      const tone = mapToneFor(theme)
      expect(contrast(tone.ink, tone.paper)).toBeGreaterThanOrEqual(4.5)
    }
  })

  it('gives a light map in the light theme and a dark one in the dark theme', () => {
    expect(luminance(mapToneFor(LIGHT).paper)).toBeGreaterThan(0.85)
    expect(luminance(mapToneFor(DARK).paper)).toBeLessThan(0.02)
  })

  it('uses the page background itself as the map paper', () => {
    expect(mapToneFor(LIGHT).paper).toEqual(LIGHT.background)
    expect(mapToneFor(DARK).paper).toEqual(DARK.background)
  })

  it('tints the mid-tones toward the brand colour, only slightly', () => {
    const tone = mapToneFor(LIGHT)
    const neutral = mixRgb(LIGHT.foreground, LIGHT.background, 0.62)
    // Warmer than the neutral grey: more red than blue, as the primary is.
    expect(tone.mid[0] - tone.mid[2]).toBeGreaterThan(neutral[0] - neutral[2])
    // …but still a calm tone, not the brand colour.
    expect(contrast(tone.mid, LIGHT.primary)).toBeGreaterThan(1.5)
  })

  it('follows any palette, e.g. a store with its own colours', () => {
    const store = {
      foreground: [0x0b, 0x1f, 0x33] as Rgb,
      background: [0xf0, 0xf7, 0xff] as Rgb,
      primary: [0x00, 0x66, 0xcc] as Rgb,
    }
    const tone = mapToneFor(store)
    expect(tone.paper).toEqual(store.background)
    expect(contrast(tone.ink, tone.paper)).toBeGreaterThanOrEqual(4.5)
  })
})

describe('toneTables', () => {
  it('lists ink, mid and paper per channel as 0–1 values', () => {
    const tables = toneTables({
      ink: [0, 0, 0],
      mid: [255, 128, 0],
      paper: [255, 255, 255],
    })
    expect(tables.r).toBe('0.000 1.000 1.000')
    expect(tables.g).toBe('0.000 0.502 1.000')
    expect(tables.b).toBe('0.000 0.000 1.000')
  })
})

describe('mixRgb', () => {
  it('mixes linearly and stays within bytes', () => {
    expect(mixRgb([0, 0, 0], [255, 255, 255], 0.5)).toEqual([128, 128, 128])
    expect(mixRgb([10, 20, 30], [10, 20, 30], 0.3)).toEqual([10, 20, 30])
  })
})
