/**
 * Dominant colour extraction for an uploaded logo.
 *
 * The quantiser is deliberately pure — it takes the RGBA bytes a canvas hands
 * back and nothing else — so it can be tested against a synthetic pixel array
 * with no browser in sight. The canvas side of the job lives in
 * `components/dashboard/theme/logo-color-extractor`.
 *
 * Method: uniform 5-bit-per-channel bucketing (32 levels per channel, 32768
 * cells). It is not the most accurate quantiser in the world, but it is
 * deterministic, allocation-light and more than good enough to answer the only
 * question being asked: "which four colours is this logo mostly made of?".
 */

/** Bits kept per channel. 5 merges near identical shades without smearing. */
const BITS = 5
const SHIFT = 8 - BITS
const LEVELS = 1 << BITS

/** Below this alpha a pixel is scenery, not colour. */
const MIN_ALPHA = 128

/**
 * Flat neutrals (a white card, a black outline) dominate most logos by area
 * but say nothing about the brand, so their weight is discounted rather than
 * dropped — a logo that really is black and white still gets an answer.
 */
const NEUTRAL_WEIGHT = 0.08
const NEUTRAL_SATURATION = 0.12
const NEUTRAL_LIGHTNESS_EDGE = 0.06

interface Bucket {
  key: number
  count: number
  weight: number
  r: number
  g: number
  b: number
}

/** Cheap HSL-ish saturation and lightness on 0..1 channels. */
function saturationAndLightness(
  r: number,
  g: number,
  b: number,
): { saturation: number; lightness: number } {
  const max = Math.max(r, g, b)
  const min = Math.min(r, g, b)
  const lightness = (max + min) / 2
  const delta = max - min
  if (delta === 0) return { saturation: 0, lightness }
  const saturation = delta / (1 - Math.abs(2 * lightness - 1) || 1)
  return { saturation: Math.min(1, saturation), lightness }
}

function toHex(value: number): string {
  return Math.round(Math.min(255, Math.max(0, value)))
    .toString(16)
    .padStart(2, '0')
}

/**
 * The `max` most representative colours of an RGBA buffer, most prominent
 * first, as canonical lowercase hex. Transparent pixels are skipped, a
 * truncated trailing pixel is ignored and an empty or fully transparent buffer
 * returns an empty list.
 */
export function quantizeColors(pixels: Uint8ClampedArray, max = 4): string[] {
  if (max <= 0) return []

  const buckets = new Map<number, Bucket>()
  // `- 3` so a truncated trailing pixel is never read past its end.
  for (let index = 0; index + 3 < pixels.length; index += 4) {
    const alpha = pixels[index + 3]
    if (alpha < MIN_ALPHA) continue

    const r = pixels[index]
    const g = pixels[index + 1]
    const b = pixels[index + 2]
    const key = ((r >> SHIFT) * LEVELS + (g >> SHIFT)) * LEVELS + (b >> SHIFT)

    const { saturation, lightness } = saturationAndLightness(
      r / 255,
      g / 255,
      b / 255,
    )
    const neutral =
      saturation < NEUTRAL_SATURATION ||
      lightness < NEUTRAL_LIGHTNESS_EDGE ||
      lightness > 1 - NEUTRAL_LIGHTNESS_EDGE
    const weight = neutral ? NEUTRAL_WEIGHT : 1

    const bucket = buckets.get(key)
    if (bucket) {
      bucket.count += 1
      bucket.weight += weight
      bucket.r += r
      bucket.g += g
      bucket.b += b
      continue
    }
    buckets.set(key, { key, count: 1, weight, r, g, b })
  }

  return [...buckets.values()]
    .sort((a, b) => b.weight - a.weight || b.count - a.count || a.key - b.key)
    .slice(0, max)
    .map(
      (bucket) =>
        `#${toHex(bucket.r / bucket.count)}${toHex(bucket.g / bucket.count)}${toHex(
          bucket.b / bucket.count,
        )}`,
    )
}
