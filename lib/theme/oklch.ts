/**
 * sRGB hex ↔ OKLCH.
 *
 * Harmonies are computed in OKLCH rather than HSL because OKLCH is
 * perceptually uniform: rotating the hue of a brand colour keeps the new
 * colour at the same apparent lightness, so a generated palette does not come
 * out with a washed-out yellow next to a heavy blue.
 *
 * Pure, dependency free and deterministic, so `lib/theme/palette` can be unit
 * tested without a browser.
 *
 * @see https://bottosson.github.io/posts/oklab/
 */

const HEX_PATTERN = /^#?([0-9a-f]{3}|[0-9a-f]{6})$/i

/** Lightness 0..1, chroma 0..~0.4, hue 0..360 (degrees). */
export interface Oklch {
  l: number
  c: number
  h: number
}

function clamp(value: number, min: number, max: number): number {
  if (!Number.isFinite(value)) return min
  return Math.min(max, Math.max(min, value))
}

/** Expands `#abc` / `abc` to the six digits `aabbcc`. Throws on anything else. */
function hexDigits(hex: string): string {
  const match = typeof hex === 'string' ? HEX_PATTERN.exec(hex.trim()) : null
  if (!match) throw new Error(`Invalid hex color: "${String(hex)}".`)
  const digits = match[1].toLowerCase()
  return digits.length === 3
    ? digits
        .split('')
        .map((char) => char + char)
        .join('')
    : digits
}

/** sRGB 0..1 to linear-light. */
function linearize(channel: number): number {
  return channel <= 0.04045
    ? channel / 12.92
    : Math.pow((channel + 0.055) / 1.055, 2.4)
}

/** Linear-light to sRGB 0..1. */
function delinearize(channel: number): number {
  return channel <= 0.0031308
    ? channel * 12.92
    : 1.055 * Math.pow(channel, 1 / 2.4) - 0.055
}

interface LinearRgb {
  r: number
  g: number
  b: number
}

function oklabToLinearRgb(l: number, a: number, b: number): LinearRgb {
  const lc = l + 0.3963377774 * a + 0.2158037573 * b
  const mc = l - 0.1055613458 * a - 0.0638541728 * b
  const sc = l - 0.0894841775 * a - 1.291485548 * b

  const l3 = lc * lc * lc
  const m3 = mc * mc * mc
  const s3 = sc * sc * sc

  return {
    r: 4.0767416621 * l3 - 3.3077115913 * m3 + 0.2309699292 * s3,
    g: -1.2684380046 * l3 + 2.6097574011 * m3 - 0.3413193965 * s3,
    b: -0.0041960863 * l3 - 0.7034186147 * m3 + 1.707614701 * s3,
  }
}

/** True when every linear channel sits inside sRGB with a hair of tolerance. */
function inGamut({ r, g, b }: LinearRgb): boolean {
  const epsilon = 1e-4
  return [r, g, b].every(
    (channel) => channel >= -epsilon && channel <= 1 + epsilon,
  )
}

/** Converts a hex colour to OKLCH. Throws when the input is not a colour. */
export function hexToOklch(hex: string): Oklch {
  const digits = hexDigits(hex)
  const [r, g, b] = [0, 2, 4].map((offset) =>
    linearize(parseInt(digits.slice(offset, offset + 2), 16) / 255),
  )

  const lc = Math.cbrt(0.4122214708 * r + 0.5363325363 * g + 0.0514459929 * b)
  const mc = Math.cbrt(0.2119034982 * r + 0.6806995451 * g + 0.1073969566 * b)
  const sc = Math.cbrt(0.0883024619 * r + 0.2817188376 * g + 0.6299787005 * b)

  const lightness = 0.2104542553 * lc + 0.793617785 * mc - 0.0040720468 * sc
  const a = 1.9779984951 * lc - 2.428592205 * mc + 0.4505937099 * sc
  const bb = 0.0259040371 * lc + 0.7827717662 * mc - 0.808675766 * sc

  const chroma = Math.sqrt(a * a + bb * bb)
  // A neutral has no meaningful hue; report 0 instead of an atan2 artefact.
  const hue =
    chroma < 1e-6 ? 0 : ((Math.atan2(bb, a) * 180) / Math.PI + 360) % 360

  return { l: clamp(lightness, 0, 1), c: chroma, h: hue }
}

function toHexChannel(linear: number): string {
  const value = Math.round(clamp(delinearize(linear), 0, 1) * 255)
  return value.toString(16).padStart(2, '0')
}

/**
 * Converts OKLCH back to `#rrggbb`.
 *
 * Out-of-gamut colours are mapped by binary-searching the chroma down until
 * the colour fits inside sRGB, which keeps the hue and the lightness the
 * merchant asked for instead of clipping a channel and shifting the hue.
 */
export function oklchToHex(color: Oklch): string {
  const lightness = clamp(color.l, 0, 1)
  const hue = Number.isFinite(color.h) ? color.h : 0
  const radians = (hue * Math.PI) / 180
  const requested = Math.max(0, Number.isFinite(color.c) ? color.c : 0)

  const at = (chroma: number): LinearRgb =>
    oklabToLinearRgb(
      lightness,
      Math.cos(radians) * chroma,
      Math.sin(radians) * chroma,
    )

  let rgb = at(requested)
  if (!inGamut(rgb)) {
    let low = 0
    let high = requested
    for (let step = 0; step < 24; step += 1) {
      const mid = (low + high) / 2
      if (inGamut(at(mid))) low = mid
      else high = mid
    }
    rgb = at(low)
  }

  return `#${toHexChannel(rgb.r)}${toHexChannel(rgb.g)}${toHexChannel(rgb.b)}`
}

/** Same colour, hue turned by `degrees` and wrapped into [0, 360). */
export function rotateHue(color: Oklch, degrees: number): Oklch {
  return { ...color, h: (((color.h + degrees) % 360) + 360) % 360 }
}

/** Same colour at a different lightness, clamped to 0..1. */
export function withLightness(color: Oklch, lightness: number): Oklch {
  return { ...color, l: clamp(lightness, 0, 1) }
}

/** Same colour at a different chroma, clamped to 0..0.4. */
export function withChroma(color: Oklch, chroma: number): Oklch {
  return { ...color, c: clamp(chroma, 0, 0.4) }
}
