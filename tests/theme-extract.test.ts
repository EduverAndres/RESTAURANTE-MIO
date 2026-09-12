import { describe, expect, it } from 'vitest'
import { quantizeColors } from '@/lib/theme/extract'

/** Builds an RGBA pixel buffer from `[hex, count]` pairs. */
function pixels(...runs: [string, number][]): Uint8ClampedArray {
  const bytes: number[] = []
  for (const [hex, count] of runs) {
    const r = parseInt(hex.slice(1, 3), 16)
    const g = parseInt(hex.slice(3, 5), 16)
    const b = parseInt(hex.slice(5, 7), 16)
    for (let index = 0; index < count; index += 1) bytes.push(r, g, b, 255)
  }
  return new Uint8ClampedArray(bytes)
}

describe('quantizeColors', () => {
  it('returns the dominant colour of a single colour image', () => {
    const result = quantizeColors(pixels(['#c2410c', 50]), 4)
    expect(result).toHaveLength(1)
    expect(result[0]).toMatch(/^#[0-9a-f]{6}$/)
  })

  it('orders colours by how much of the image they cover', () => {
    const result = quantizeColors(
      pixels(['#ff0000', 100], ['#00ff00', 50], ['#0000ff', 10]),
      3,
    )
    expect(result).toHaveLength(3)
    // Red first, then green, then blue.
    expect(result[0].slice(1, 3)).toBe('ff')
    expect(result[1].slice(3, 5)).toBe('ff')
    expect(result[2].slice(5, 7)).toBe('ff')
  })

  it('never returns more than the requested count', () => {
    const result = quantizeColors(
      pixels(
        ['#ff0000', 10],
        ['#00ff00', 9],
        ['#0000ff', 8],
        ['#ffff00', 7],
        ['#ff00ff', 6],
        ['#00ffff', 5],
      ),
      4,
    )
    expect(result).toHaveLength(4)
  })

  it('merges near identical shades into one suggestion', () => {
    const result = quantizeColors(
      pixels(['#c2410c', 40], ['#c3420d', 40], ['#c1400b', 40]),
      4,
    )
    expect(result).toHaveLength(1)
  })

  it('skips transparent pixels', () => {
    const opaque = pixels(['#00ff00', 4])
    const buffer = new Uint8ClampedArray([
      255,
      0,
      0,
      0,
      255,
      0,
      0,
      10,
      ...Array.from(opaque),
    ])
    const result = quantizeColors(buffer, 4)
    expect(result).toHaveLength(1)
    expect(result[0].slice(3, 5)).toBe('ff')
  })

  it('returns an empty list when nothing is usable', () => {
    expect(quantizeColors(new Uint8ClampedArray([]), 4)).toEqual([])
    expect(quantizeColors(new Uint8ClampedArray([1, 2, 3, 0]), 4)).toEqual([])
  })

  it('ignores a truncated trailing pixel instead of reading past the end', () => {
    const buffer = new Uint8ClampedArray([0, 255, 0, 255, 12, 34])
    expect(quantizeColors(buffer, 4)).toHaveLength(1)
  })

  it('prefers a saturated brand colour over a flat white background', () => {
    const result = quantizeColors(pixels(['#ffffff', 900], ['#c2410c', 100]), 2)
    expect(result[0]).not.toBe('#ffffff')
  })

  it('still returns the neutrals when the image has nothing else', () => {
    const result = quantizeColors(pixels(['#ffffff', 100], ['#111111', 60]), 4)
    expect(result.length).toBeGreaterThanOrEqual(1)
  })

  it('is deterministic', () => {
    const buffer = pixels(['#ff0000', 10], ['#00ff00', 10], ['#0000ff', 10])
    expect(quantizeColors(buffer, 3)).toEqual(quantizeColors(buffer, 3))
  })

  it('returns canonical lowercase hex', () => {
    for (const hex of quantizeColors(pixels(['#AB12EF', 20]), 2)) {
      expect(hex).toMatch(/^#[0-9a-f]{6}$/)
    }
  })
})
