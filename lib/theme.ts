import {
  DEFAULT_STORE_THEME,
  THEME_BANNER_LAYOUTS,
  THEME_BUTTON_STYLES,
  THEME_FONTS,
  THEME_SECTIONS,
  type StoreTheme,
  type StoreThemeBanner,
  type ThemeBannerLayout,
  type ThemeButtonStyle,
  type ThemeFont,
  type ThemeSection,
} from '@/types/app'

// ---------------------------------------------------------------------------
// Colors
// ---------------------------------------------------------------------------

const HEX_PATTERN = /^#?([0-9a-f]{3}|[0-9a-f]{6})$/i

/**
 * Converts "#C2410C" (or "C2410C", or "#fff") into "194 65 12" so it can be
 * used inside `rgb(var(--x) / 0.5)`. Returns null for anything else.
 */
export function hexToRgb(hex: string): string | null {
  const match = HEX_PATTERN.exec(hex.trim())
  if (!match) return null

  let digits = match[1]
  if (digits.length === 3) {
    digits = digits
      .split('')
      .map((char) => char + char)
      .join('')
  }

  const r = parseInt(digits.slice(0, 2), 16)
  const g = parseInt(digits.slice(2, 4), 16)
  const b = parseInt(digits.slice(4, 6), 16)
  return `${r} ${g} ${b}`
}

/**
 * Canonical `#rrggbb` lowercase form (expands `#abc`, adds a missing hash),
 * matching `HEX_COLOR_PATTERN` in lib/validations/theme. Null if invalid.
 */
export function normalizeHex(value: unknown): string | null {
  if (typeof value !== 'string') return null
  const match = HEX_PATTERN.exec(value.trim())
  if (!match) return null
  let digits = match[1].toLowerCase()
  if (digits.length === 3) {
    digits = digits
      .split('')
      .map((char) => char + char)
      .join('')
  }
  return `#${digits}`
}

// ---------------------------------------------------------------------------
// Fonts
// ---------------------------------------------------------------------------

const SERIF_STACK = 'ui-serif, Georgia, "Times New Roman", serif'
const SANS_STACK =
  'ui-sans-serif, system-ui, -apple-system, "Segoe UI", Roboto, sans-serif'

const SERIF_FONTS: ReadonlySet<ThemeFont> = new Set([
  'Fraunces',
  'Instrument Serif',
  'Playfair Display',
])

export function fontFamilyStack(font: ThemeFont): string {
  const fallback = SERIF_FONTS.has(font) ? SERIF_STACK : SANS_STACK
  return `"${font}", ${fallback}`
}

// ---------------------------------------------------------------------------
// Merge
// ---------------------------------------------------------------------------

function isOneOf<T extends string>(
  list: readonly T[],
  value: unknown,
): value is T {
  return (
    typeof value === 'string' && (list as readonly string[]).includes(value)
  )
}

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === 'object' && value !== null && !Array.isArray(value)
}

function mergeBanner(input: unknown, base: StoreThemeBanner): StoreThemeBanner {
  if (!isRecord(input)) return { ...base }
  const imageUrl =
    typeof input.imageUrl === 'string' || input.imageUrl === null
      ? input.imageUrl
      : base.imageUrl
  const overlayOpacity =
    typeof input.overlayOpacity === 'number' &&
    input.overlayOpacity >= 0 &&
    input.overlayOpacity <= 1
      ? input.overlayOpacity
      : base.overlayOpacity
  const layout: ThemeBannerLayout = isOneOf(THEME_BANNER_LAYOUTS, input.layout)
    ? input.layout
    : base.layout
  return { imageUrl, overlayOpacity, layout }
}

/**
 * Every THEME_SECTIONS entry exactly once: the valid given order first (first
 * occurrence wins, unknowns dropped), then the missing ones in `fallback` order.
 */
function normalizeSectionOrder(
  input: unknown,
  fallback: readonly ThemeSection[],
): ThemeSection[] {
  const given = Array.isArray(input) ? input : []
  const order: ThemeSection[] = []
  for (const section of given) {
    if (isOneOf(THEME_SECTIONS, section) && !order.includes(section))
      order.push(section)
  }
  for (const section of fallback) {
    if (!order.includes(section)) order.push(section)
  }
  return order
}

/**
 * Builds a complete StoreTheme from untrusted JSON (the `stores.theme`
 * column) over DEFAULT_STORE_THEME. Invalid or unknown values are dropped so
 * a malformed theme can never break rendering.
 */
export function mergeTheme(partial: unknown): StoreTheme {
  const base = DEFAULT_STORE_THEME
  if (!isRecord(partial)) {
    return {
      ...base,
      banner: { ...base.banner },
      sectionOrder: [...base.sectionOrder],
    }
  }

  const pickColor = (key: keyof StoreTheme): string =>
    normalizeHex(partial[key]) ?? (base[key] as string)

  const radius =
    typeof partial.radius === 'number' &&
    partial.radius >= 0 &&
    partial.radius <= 64
      ? partial.radius
      : base.radius

  const fontDisplay: ThemeFont = isOneOf(THEME_FONTS, partial.fontDisplay)
    ? partial.fontDisplay
    : base.fontDisplay
  const fontBody: ThemeFont = isOneOf(THEME_FONTS, partial.fontBody)
    ? partial.fontBody
    : base.fontBody
  const buttonStyle: ThemeButtonStyle = isOneOf(
    THEME_BUTTON_STYLES,
    partial.buttonStyle,
  )
    ? partial.buttonStyle
    : base.buttonStyle

  const sectionOrder = normalizeSectionOrder(
    partial.sectionOrder,
    base.sectionOrder,
  )

  const logoUrl =
    typeof partial.logoUrl === 'string' || partial.logoUrl === null
      ? partial.logoUrl
      : base.logoUrl

  return {
    primary: pickColor('primary'),
    accent: pickColor('accent'),
    background: pickColor('background'),
    surface: pickColor('surface'),
    text: pickColor('text'),
    radius,
    fontDisplay,
    fontBody,
    banner: mergeBanner(partial.banner, base.banner),
    logoUrl,
    sectionOrder,
    buttonStyle,
  }
}

// ---------------------------------------------------------------------------
// CSS variables
// ---------------------------------------------------------------------------

const BUTTON_RADIUS: Record<ThemeButtonStyle, string> = {
  pill: '999px',
  rounded: '12px',
  square: '4px',
}

/**
 * Maps a StoreTheme to the `--store-*` custom properties declared in
 * globals.css. Apply the result as an inline style on the store wrapper.
 */
export function themeToCssVars(theme: StoreTheme): Record<string, string> {
  return {
    '--store-primary': theme.primary,
    '--store-primary-rgb': hexToRgb(theme.primary) ?? '0 0 0',
    '--store-accent': theme.accent,
    '--store-accent-rgb': hexToRgb(theme.accent) ?? '0 0 0',
    '--store-background': theme.background,
    '--store-background-rgb': hexToRgb(theme.background) ?? '255 255 255',
    '--store-surface': theme.surface,
    '--store-surface-rgb': hexToRgb(theme.surface) ?? '255 255 255',
    '--store-text': theme.text,
    '--store-text-rgb': hexToRgb(theme.text) ?? '0 0 0',
    '--store-radius': `${theme.radius}px`,
    '--store-button-radius': BUTTON_RADIUS[theme.buttonStyle],
    '--store-font-display': fontFamilyStack(theme.fontDisplay),
    '--store-font-body': fontFamilyStack(theme.fontBody),
    '--store-banner-overlay': String(theme.banner.overlayOpacity),
  }
}
