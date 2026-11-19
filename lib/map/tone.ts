// Map tone: turns the theme's colours into a duotone for the raster map.
//
// OpenStreetMap tiles come in one fixed palette. Instead of a second tile
// provider (CARTO's free styles now need an API key), the tiles are recoloured
// in the browser: an SVG filter takes each pixel's luminance and maps it onto
// a ramp built from the page's own tokens — ink (`--foreground`) for labels
// and lines, paper (`--background`) for land, and a breath of `--primary` in
// the mid-tones. Because the colours are read from the CSS variables where the
// map lives, the same rule gives a light map in the light theme, a dark map in
// the dark theme, and a store's own palette on its storefront. Pure: no DOM.

export type Rgb = readonly [number, number, number]

/** How much of the primary colour tints the mid-tones (water, parks). */
const PRIMARY_TINT = 0.14
/**
 * Ink is pulled this far toward paper so streets and blocks read as a calm
 * background behind the markers; labels keep well over 4.5:1 on paper.
 */
const INK_SOFTEN = 0.18

function clampByte(value: number): number {
  return Math.min(255, Math.max(0, Math.round(value)))
}

/** Linear mix in sRGB space: t = 0 gives `a`, t = 1 gives `b`. */
export function mixRgb(a: Rgb, b: Rgb, t: number): Rgb {
  return [
    clampByte(a[0] + (b[0] - a[0]) * t),
    clampByte(a[1] + (b[1] - a[1]) * t),
    clampByte(a[2] + (b[2] - a[2]) * t),
  ]
}

/** WCAG relative luminance, 0 (black) to 1 (white). */
export function luminance([r, g, b]: Rgb): number {
  const channel = (value: number) => {
    const c = value / 255
    return c <= 0.03928 ? c / 12.92 : ((c + 0.055) / 1.055) ** 2.4
  }
  return 0.2126 * channel(r) + 0.7152 * channel(g) + 0.0722 * channel(b)
}

/** WCAG contrast ratio between two colours (1 to 21). */
export function contrast(a: Rgb, b: Rgb): number {
  const [hi, lo] = [luminance(a), luminance(b)].sort((x, y) => y - x)
  return (hi! + 0.05) / (lo! + 0.05)
}

export interface MapTone {
  /** Colour a fully dark tile pixel (text, outlines) becomes. */
  ink: Rgb
  /** Colour of the mid-tones (water, parks, minor roads). */
  mid: Rgb
  /** Colour a fully light tile pixel (land, main roads) becomes. */
  paper: Rgb
}

/**
 * The ramp for a theme. Dark tile pixels go to (softened) ink and light ones
 * to paper, so a dark theme — light ink, dark paper — inverts the map with no
 * special case.
 */
export function mapToneFor({
  foreground,
  background,
  primary,
}: {
  foreground: Rgb
  background: Rgb
  primary: Rgb
}): MapTone {
  const ink = mixRgb(foreground, background, INK_SOFTEN)
  const neutralMid = mixRgb(foreground, background, 0.62)
  const mid = mixRgb(neutralMid, primary, PRIMARY_TINT)
  return { ink, mid, paper: background }
}

/**
 * `tableValues` for feFuncR/G/B: ink at luminance 0, mid at 0.5, paper at 1.
 * Values are 0–1 with three decimals, the precision the filter can show.
 */
export function toneTables(tone: MapTone): { r: string; g: string; b: string } {
  const channel = (index: 0 | 1 | 2) =>
    [tone.ink, tone.mid, tone.paper]
      .map((colour) => (colour[index] / 255).toFixed(3))
      .join(' ')
  return { r: channel(0), g: channel(1), b: channel(2) }
}

/**
 * feColorMatrix values that turn a pixel into its luminance on every channel
 * (Rec. 709 weights), the input the duotone table expects.
 */
export const LUMINANCE_MATRIX = [
  '0.2126 0.7152 0.0722 0 0',
  '0.2126 0.7152 0.0722 0 0',
  '0.2126 0.7152 0.0722 0 0',
  '0 0 0 1 0',
].join(' ')
