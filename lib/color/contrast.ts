/**
 * WCAG 2.1 relative luminance and contrast ratio for sRGB hex colors.
 *
 * Pure and dependency free so design-token tests can measure the palette in
 * `app/globals.css` without a browser.
 *
 * @see https://www.w3.org/TR/WCAG21/#dfn-relative-luminance
 * @see https://www.w3.org/TR/WCAG21/#dfn-contrast-ratio
 */

const HEX_PATTERN = /^#?([0-9a-f]{3}|[0-9a-f]{6})$/i

/** Expands `#abc` / `abc` to the six digits `aabbcc`. */
function hexDigits(hex: string): string {
  if (typeof hex !== 'string') {
    throw new Error(`Invalid hex color: expected a string, got ${typeof hex}`)
  }
  const match = HEX_PATTERN.exec(hex.trim())
  if (!match) {
    throw new Error(
      `Invalid hex color: "${hex}". Expected #rgb, #rrggbb (the leading "#" is optional).`,
    )
  }
  const digits = match[1].toLowerCase()
  return digits.length === 3
    ? digits
        .split('')
        .map((char) => char + char)
        .join('')
    : digits
}

/** sRGB 0..1 channel to its linear-light value. */
function linearize(channel: number): number {
  return channel <= 0.04045
    ? channel / 12.92
    : Math.pow((channel + 0.055) / 1.055, 2.4)
}

/**
 * Relative luminance of a hex color: 0 for black, 1 for white.
 * Throws a descriptive Error when the input is not a hex color.
 */
export function relativeLuminance(hex: string): number {
  const digits = hexDigits(hex)
  const [r, g, b] = [0, 2, 4].map((offset) =>
    linearize(parseInt(digits.slice(offset, offset + 2), 16) / 255),
  )
  return 0.2126 * r + 0.7152 * g + 0.0722 * b
}

/**
 * Contrast ratio between two hex colors, from 1 (identical) to 21
 * (black on white). Symmetric in its arguments.
 */
export function contrastRatio(a: string, b: string): number {
  const first = relativeLuminance(a)
  const second = relativeLuminance(b)
  const lighter = Math.max(first, second)
  const darker = Math.min(first, second)
  return (lighter + 0.05) / (darker + 0.05)
}
