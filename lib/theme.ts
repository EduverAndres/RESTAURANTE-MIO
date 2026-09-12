import { contrastRatio } from '@/lib/color/contrast'
import {
  DEFAULT_STORE_THEME,
  THEME_BADGE_STYLES,
  THEME_BANNER_LAYOUTS,
  THEME_BUTTON_STYLES,
  THEME_CARD_STYLES,
  THEME_CATEGORY_NAVS,
  THEME_DENSITIES,
  THEME_FEATURED_LAYOUTS,
  THEME_FONTS,
  THEME_HEADING_CASES,
  THEME_HEADING_WEIGHTS,
  THEME_HERO_ALIGNS,
  THEME_IMAGE_RATIOS,
  THEME_IMAGE_SHAPES,
  THEME_LETTER_SPACINGS,
  THEME_LOGO_SIZES,
  THEME_MENU_LAYOUTS,
  THEME_MODES,
  THEME_MOTIONS,
  THEME_PATTERNS,
  THEME_PRODUCT_HOVERS,
  THEME_SECTIONS,
  THEME_SHOW_PRICES,
  type StoreTheme,
  type StoreThemeBadges,
  type StoreThemeBanner,
  type StoreThemeFeatured,
  type StoreThemeFooter,
  type StoreThemeGradient,
  type StoreThemeHero,
  type StoreThemeSocial,
  type StoreThemeStory,
  type ThemeBannerLayout,
  type ThemeButtonStyle,
  type ThemeCardStyle,
  type ThemeDensity,
  type ThemeFont,
  type ThemeImageRatio,
  type ThemeLetterSpacing,
  type ThemeMotion,
  type ThemePattern,
  type ThemeSection,
} from '@/types/app'

/** Re-exported so callers get colour maths and theme maths from one module. */
export { contrastRatio } from '@/lib/color/contrast'

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
// Custom CSS sanitisation
// ---------------------------------------------------------------------------

/** The only selector a merchant stylesheet is ever allowed to reach. */
const STORE_SCOPE = '[data-store-theme]'

const CUSTOM_CSS_MAX_BYTES = 4096

/**
 * Anything that turns CSS into code, escapes the stylesheet, or hides a
 * payload behind an escape sequence. `\` is banned outright because
 * `\40 import` is the classic way to smuggle an at-rule past a token filter,
 * and `</` because it would break out of a `<style>` element.
 */
const FORBIDDEN_TOKEN =
  /(expression\s*\(|javascript\s*:|behaviou?r\s*:|-moz-binding|<\/|\\|@)/i

/** Only `data:` URIs may be referenced; anything remote is dropped. */
const URL_CALL = /url\(\s*(['"]?)([^'")]*)\1\s*\)/gi

/** Conservative selector alphabet: classes, ids, tags, attributes, pseudos. */
const SELECTOR_ALLOWED = /^[a-z0-9_\-.#*:>+~[\]="' ,()]+$/i

/** A selector that would leave the store container behind. */
const SELECTOR_ESCAPES = /(^|[\s,>+~])(:root|html|body)\b/i

const PROPERTY_NAME = /^-{0,2}[a-z][a-z0-9-]*$/i

/** Removes `/* ... *​/` comments, including an unterminated trailing one. */
function stripComments(css: string): string {
  let out = ''
  let index = 0
  while (index < css.length) {
    const start = css.indexOf('/*', index)
    if (start === -1) {
      out += css.slice(index)
      break
    }
    out += css.slice(index, start)
    const end = css.indexOf('*/', start + 2)
    if (end === -1) break
    index = end + 2
  }
  return out
}

/** Drops every at-rule, prelude and body included (`@import`, `@media`, ...). */
function stripAtRules(css: string): string {
  let out = ''
  let index = 0
  while (index < css.length) {
    const at = css.indexOf('@', index)
    if (at === -1) {
      out += css.slice(index)
      break
    }
    out += css.slice(index, at)

    let cursor = at
    let depth = 0
    let closed = false
    while (cursor < css.length) {
      const char = css[cursor]
      if (char === '{') depth += 1
      else if (char === '}') {
        depth -= 1
        if (depth <= 0) {
          cursor += 1
          closed = true
          break
        }
      } else if (char === ';' && depth === 0) {
        cursor += 1
        closed = true
        break
      }
      cursor += 1
    }
    index = closed ? cursor : css.length
  }
  return out
}

/** Splits on `separator`, ignoring separators inside quotes or parentheses. */
function splitTopLevel(input: string, separator: string): string[] {
  const parts: string[] = []
  let buffer = ''
  let depth = 0
  let quote: string | null = null
  for (const char of input) {
    if (quote) {
      buffer += char
      if (char === quote) quote = null
      continue
    }
    if (char === '"' || char === "'") {
      quote = char
      buffer += char
      continue
    }
    if (char === '(') depth += 1
    else if (char === ')') depth = Math.max(0, depth - 1)
    if (char === separator && depth === 0) {
      parts.push(buffer)
      buffer = ''
      continue
    }
    buffer += char
  }
  parts.push(buffer)
  return parts
}

function isSafeValue(value: string): boolean {
  if (!value || FORBIDDEN_TOKEN.test(value)) return false
  URL_CALL.lastIndex = 0
  let match = URL_CALL.exec(value)
  while (match) {
    if (!/^data:/i.test(match[2].trim())) return false
    match = URL_CALL.exec(value)
  }
  return true
}

function sanitizeSelectorList(selector: string): string[] {
  const kept: string[] = []
  for (const part of splitTopLevel(selector, ',')) {
    const sel = part.trim().replace(/\s+/g, ' ')
    if (!sel) continue
    if (FORBIDDEN_TOKEN.test(sel)) continue
    if (!SELECTOR_ALLOWED.test(sel)) continue
    if (SELECTOR_ESCAPES.test(sel)) continue
    kept.push(sel.startsWith(STORE_SCOPE) ? sel : `${STORE_SCOPE} ${sel}`)
  }
  return kept
}

function sanitizeDeclarations(body: string): string[] {
  const kept: string[] = []
  for (const raw of splitTopLevel(body, ';')) {
    const declaration = raw.trim()
    if (!declaration || /[{}]/.test(declaration)) continue
    const colon = declaration.indexOf(':')
    if (colon <= 0) continue
    const property = declaration.slice(0, colon).trim().toLowerCase()
    const value = declaration.slice(colon + 1).trim()
    if (!PROPERTY_NAME.test(property)) continue
    if (!isSafeValue(value)) continue
    kept.push(`${property}: ${value}`)
  }
  return kept
}

interface CssBlock {
  selector: string
  body: string
}

/** Splits `sel { body }` pairs; trailing bare declarations get an empty selector. */
function parseBlocks(css: string): CssBlock[] {
  const blocks: CssBlock[] = []
  let buffer = ''
  let index = 0
  while (index < css.length) {
    const char = css[index]
    if (char === '{') {
      const selector = buffer.trim()
      buffer = ''
      index += 1
      let depth = 1
      let body = ''
      while (index < css.length) {
        const inner = css[index]
        if (inner === '{') depth += 1
        else if (inner === '}') {
          depth -= 1
          if (depth === 0) {
            index += 1
            break
          }
        }
        body += inner
        index += 1
      }
      blocks.push({ selector, body })
      continue
    }
    if (char === '}') {
      buffer = ''
      index += 1
      continue
    }
    buffer += char
    index += 1
  }
  if (buffer.trim()) blocks.push({ selector: '', body: buffer })
  return blocks
}

/**
 * Sanitises merchant supplied CSS.
 *
 * Policy, in order:
 * 1. Input over 4 KB (UTF-8 bytes) is rejected outright — the editor caps it
 *    too, so an oversized value means the row was written around the form.
 * 2. Comments are removed first, so nothing can hide a payload inside one.
 * 3. Every at-rule is dropped, prelude and body: no `@import`, no `@media`,
 *    no `@font-face`, no layer or container games.
 * 4. Only declarations survive. A property must look like a property and its
 *    value may not contain `expression()`, `javascript:`, `behavior:`,
 *    `-moz-binding`, `</`, a backslash escape, or a `url()` pointing anywhere
 *    other than a `data:` URI.
 * 5. Every selector is prefixed with `[data-store-theme]`, and selectors that
 *    target `:root`, `html` or `body` are dropped, so nothing can restyle the
 *    app around the storefront. Bare declarations are wrapped in the scope.
 *
 * Returns null when nothing survives.
 */
export function sanitizeCustomCss(input: string | null): string | null {
  if (typeof input !== 'string') return null
  if (new TextEncoder().encode(input).length > CUSTOM_CSS_MAX_BYTES) return null

  const source = stripAtRules(stripComments(input))
  if (!source.trim()) return null

  const rules: string[] = []
  for (const block of parseBlocks(source)) {
    const declarations = sanitizeDeclarations(block.body)
    if (declarations.length === 0) continue
    const selectors = block.selector
      ? sanitizeSelectorList(block.selector)
      : [STORE_SCOPE]
    if (selectors.length === 0) continue
    rules.push(`${selectors.join(', ')} { ${declarations.join('; ')} }`)
  }

  const css = rules.join('\n')
  return css.length > 0 ? css : null
}

// ---------------------------------------------------------------------------
// Normalize
// ---------------------------------------------------------------------------

function isOneOf<T extends string | number>(
  list: readonly T[],
  value: unknown,
): value is T {
  return (
    (typeof value === 'string' || typeof value === 'number') &&
    (list as readonly (string | number)[]).includes(value)
  )
}

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === 'object' && value !== null && !Array.isArray(value)
}

/** Clamps a finite number into [min, max]; anything else falls back. */
function clampNumber(
  value: unknown,
  min: number,
  max: number,
  fallback: number,
): number {
  if (typeof value !== 'number' || !Number.isFinite(value)) return fallback
  return Math.min(max, Math.max(min, value))
}

function pickBoolean(value: unknown, fallback: boolean): boolean {
  return typeof value === 'boolean' ? value : fallback
}

/** Trimmed string capped at `max`; anything else falls back. */
function pickText(value: unknown, max: number, fallback: string): string {
  if (typeof value !== 'string') return fallback
  return value.trim().slice(0, max)
}

/** Trimmed string capped at `max`, or null when absent or empty. */
function pickNullableText(
  value: unknown,
  max: number,
  fallback: string | null,
): string | null {
  if (value === null) return null
  if (typeof value !== 'string') return fallback
  const text = value.trim().slice(0, max)
  return text.length > 0 ? text : null
}

/** A plain absolute URL, or null. Used for image fields. */
function pickUrl(value: unknown, fallback: string | null): string | null {
  if (value === null) return null
  if (typeof value !== 'string') return fallback
  const text = value.trim()
  if (!text) return null
  return /^https?:\/\/\S+$/i.test(text) && text.length <= 500 ? text : null
}

/** Hero background videos are restricted to an https mp4. */
export function isHeroVideoUrl(value: string): boolean {
  return /^https:\/\/\S+\.mp4(\?\S*)?$/i.test(value.trim())
}

function pickVideoUrl(value: unknown): string | null {
  if (typeof value !== 'string') return null
  const text = value.trim()
  return text && isHeroVideoUrl(text) && text.length <= 500 ? text : null
}

/** An `@handle` or an http(s) profile URL, capped at 64 characters. */
export function isSocialHandle(value: string): boolean {
  const text = value.trim()
  if (!text || text.length > 64) return false
  return /^@?[a-z0-9._-]{1,63}$/i.test(text) || /^https?:\/\/\S+$/i.test(text)
}

function pickSocial(value: unknown): string | null {
  if (typeof value !== 'string') return null
  const text = value.trim()
  return text && isSocialHandle(text) ? text : null
}

function mergeBanner(input: unknown, base: StoreThemeBanner): StoreThemeBanner {
  if (!isRecord(input)) return { ...base }
  const layout: ThemeBannerLayout = isOneOf(THEME_BANNER_LAYOUTS, input.layout)
    ? input.layout
    : base.layout
  return {
    imageUrl:
      typeof input.imageUrl === 'string' || input.imageUrl === null
        ? input.imageUrl
        : base.imageUrl,
    overlayOpacity: clampNumber(
      input.overlayOpacity,
      0,
      1,
      base.overlayOpacity,
    ),
    layout,
  }
}

function mergeGradient(
  input: unknown,
  base: StoreThemeGradient,
): StoreThemeGradient {
  if (!isRecord(input)) return { ...base }
  return {
    enabled: pickBoolean(input.enabled, base.enabled),
    from: normalizeHex(input.from) ?? base.from,
    to: normalizeHex(input.to) ?? base.to,
    angle: clampNumber(input.angle, 0, 360, base.angle),
  }
}

function mergeBadges(input: unknown, base: StoreThemeBadges): StoreThemeBadges {
  if (!isRecord(input)) return { ...base }
  return {
    newDays: Math.round(clampNumber(input.newDays, 0, 365, base.newDays)),
    popularEnabled: pickBoolean(input.popularEnabled, base.popularEnabled),
    style: isOneOf(THEME_BADGE_STYLES, input.style) ? input.style : base.style,
  }
}

function mergeHero(input: unknown, base: StoreThemeHero): StoreThemeHero {
  if (!isRecord(input)) return { ...base }
  return {
    align: isOneOf(THEME_HERO_ALIGNS, input.align) ? input.align : base.align,
    showLogo: pickBoolean(input.showLogo, base.showLogo),
    logoSize: isOneOf(THEME_LOGO_SIZES, input.logoSize)
      ? input.logoSize
      : base.logoSize,
    tagline: pickNullableText(input.tagline, 80, base.tagline),
    showRating: pickBoolean(input.showRating, base.showRating),
    showEta: pickBoolean(input.showEta, base.showEta),
    showSchedule: pickBoolean(input.showSchedule, base.showSchedule),
    ctaLabel: pickNullableText(input.ctaLabel, 24, base.ctaLabel),
    videoUrl:
      'videoUrl' in input ? pickVideoUrl(input.videoUrl) : base.videoUrl,
  }
}

const MAX_FEATURED_PRODUCTS = 12

function mergeFeatured(
  input: unknown,
  base: StoreThemeFeatured,
): StoreThemeFeatured {
  if (!isRecord(input)) return { ...base, productIds: [...base.productIds] }
  const raw = Array.isArray(input.productIds) ? input.productIds : null
  const productIds = raw
    ? Array.from(
        new Set(
          raw.filter(
            (id): id is string =>
              typeof id === 'string' && id.trim().length > 0,
          ),
        ),
      ).slice(0, MAX_FEATURED_PRODUCTS)
    : [...base.productIds]
  return {
    title: pickText(input.title, 60, base.title) || base.title,
    productIds,
    layout: isOneOf(THEME_FEATURED_LAYOUTS, input.layout)
      ? input.layout
      : base.layout,
  }
}

function mergeStory(input: unknown, base: StoreThemeStory): StoreThemeStory {
  if (!isRecord(input)) return { ...base }
  return {
    enabled: pickBoolean(input.enabled, base.enabled),
    title: pickText(input.title, 60, base.title) || base.title,
    text:
      typeof input.text === 'string'
        ? input.text.trim().slice(0, 600)
        : base.text,
    imageUrl:
      'imageUrl' in input
        ? pickUrl(input.imageUrl, base.imageUrl)
        : base.imageUrl,
  }
}

function mergeSocial(input: unknown, base: StoreThemeSocial): StoreThemeSocial {
  if (!isRecord(input)) return { ...base }
  return {
    instagram:
      'instagram' in input ? pickSocial(input.instagram) : base.instagram,
    tiktok: 'tiktok' in input ? pickSocial(input.tiktok) : base.tiktok,
    facebook: 'facebook' in input ? pickSocial(input.facebook) : base.facebook,
    whatsapp: pickBoolean(input.whatsapp, base.whatsapp),
  }
}

function mergeFooter(input: unknown, base: StoreThemeFooter): StoreThemeFooter {
  if (!isRecord(input)) return { ...base }
  return {
    text: pickNullableText(input.text, 200, base.text),
    showMap: pickBoolean(input.showMap, base.showMap),
    showSchedule: pickBoolean(input.showSchedule, base.showSchedule),
  }
}

/**
 * The given order first (valid entries only, first occurrence wins, unknowns
 * dropped), then the sections of `fallback` that are still missing. Opt-in
 * sections outside `fallback` are kept when listed but never added, so
 * upgrading a stored theme cannot grow a storefront a section it never had.
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
 * column) over DEFAULT_STORE_THEME. Nested groups are merged key by key,
 * numeric ranges are clamped, unknown keys are dropped and nothing ever
 * throws, so a malformed theme can never break rendering.
 */
export function normalizeTheme(raw: unknown): StoreTheme {
  const base = DEFAULT_STORE_THEME
  const partial: Record<string, unknown> = isRecord(raw) ? raw : {}

  const pickColor = (key: keyof StoreTheme): string =>
    normalizeHex(partial[key]) ?? (base[key] as string)

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

  return {
    mode: isOneOf(THEME_MODES, partial.mode) ? partial.mode : base.mode,
    logoUrl:
      typeof partial.logoUrl === 'string' || partial.logoUrl === null
        ? partial.logoUrl
        : base.logoUrl,

    primary: pickColor('primary'),
    onPrimary: pickColor('onPrimary'),
    secondary: pickColor('secondary'),
    accent: pickColor('accent'),
    background: pickColor('background'),
    surface: pickColor('surface'),
    text: pickColor('text'),
    gradient: mergeGradient(partial.gradient, base.gradient),
    pattern: isOneOf(THEME_PATTERNS, partial.pattern)
      ? partial.pattern
      : base.pattern,
    patternOpacity: clampNumber(
      partial.patternOpacity,
      0,
      0.2,
      base.patternOpacity,
    ),

    fontDisplay,
    fontBody,
    headingWeight: isOneOf(THEME_HEADING_WEIGHTS, partial.headingWeight)
      ? partial.headingWeight
      : base.headingWeight,
    headingCase: isOneOf(THEME_HEADING_CASES, partial.headingCase)
      ? partial.headingCase
      : base.headingCase,
    letterSpacing: isOneOf(THEME_LETTER_SPACINGS, partial.letterSpacing)
      ? partial.letterSpacing
      : base.letterSpacing,

    radius: Math.round(clampNumber(partial.radius, 0, 64, base.radius)),
    buttonStyle,
    density: isOneOf(THEME_DENSITIES, partial.density)
      ? partial.density
      : base.density,
    cardStyle: isOneOf(THEME_CARD_STYLES, partial.cardStyle)
      ? partial.cardStyle
      : base.cardStyle,
    imageRatio: isOneOf(THEME_IMAGE_RATIOS, partial.imageRatio)
      ? partial.imageRatio
      : base.imageRatio,
    imageShape: isOneOf(THEME_IMAGE_SHAPES, partial.imageShape)
      ? partial.imageShape
      : base.imageShape,

    banner: mergeBanner(partial.banner, base.banner),
    hero: mergeHero(partial.hero, base.hero),

    menuLayout: isOneOf(THEME_MENU_LAYOUTS, partial.menuLayout)
      ? partial.menuLayout
      : base.menuLayout,
    categoryNav: isOneOf(THEME_CATEGORY_NAVS, partial.categoryNav)
      ? partial.categoryNav
      : base.categoryNav,
    productHover: isOneOf(THEME_PRODUCT_HOVERS, partial.productHover)
      ? partial.productHover
      : base.productHover,
    showPrices: isOneOf(THEME_SHOW_PRICES, partial.showPrices)
      ? partial.showPrices
      : base.showPrices,
    badges: mergeBadges(partial.badges, base.badges),

    sectionOrder: normalizeSectionOrder(
      partial.sectionOrder,
      base.sectionOrder,
    ),
    featured: mergeFeatured(partial.featured, base.featured),
    story: mergeStory(partial.story, base.story),
    social: mergeSocial(partial.social, base.social),
    footer: mergeFooter(partial.footer, base.footer),

    motion: isOneOf(THEME_MOTIONS, partial.motion)
      ? partial.motion
      : base.motion,
    customCss:
      typeof partial.customCss === 'string'
        ? sanitizeCustomCss(partial.customCss)
        : base.customCss,
  }
}

/** Legacy name of {@link normalizeTheme}; kept for existing callers. */
export const mergeTheme = normalizeTheme

// ---------------------------------------------------------------------------
// Readability
// ---------------------------------------------------------------------------

/** WCAG AA for body copy. */
const AA_TEXT = 4.5

/** The two inks `ensureReadable` may pick from for `onPrimary`. */
const NEAR_WHITE = '#ffffff'
const NEAR_BLACK = '#1c1917'

export interface ThemeWarning {
  /** The theme field the merchant should change. */
  field: string
  ratio: number
  required: number
  /** Spanish, shown next to the field in the editor. */
  message: string
}

function safeRatio(a: string, b: string): number | null {
  try {
    return contrastRatio(a, b)
  } catch {
    return null
  }
}

function round(ratio: number): number {
  return Math.round(ratio * 100) / 100
}

/**
 * Auto-fixes only what cannot be wrong on purpose and warns about the rest.
 *
 * `onPrimary` is computed, never chosen: when the stored value scores below
 * AA against `primary` it is replaced by whichever of near-white / near-black
 * reads better, so a button can never be illegible. Brand colours are left
 * exactly as the merchant set them — `text` on `background`, `text` on
 * `surface` and `secondary` on `surface` only produce a warning.
 */
export function ensureReadable(theme: StoreTheme): {
  theme: StoreTheme
  warnings: ThemeWarning[]
} {
  const warnings: ThemeWarning[] = []

  let onPrimary = theme.onPrimary
  const current = safeRatio(onPrimary, theme.primary)
  if (current === null || current < AA_TEXT) {
    const white = safeRatio(NEAR_WHITE, theme.primary) ?? 0
    const black = safeRatio(NEAR_BLACK, theme.primary) ?? 0
    onPrimary = white >= black ? NEAR_WHITE : NEAR_BLACK
    const best = Math.max(white, black)
    if (best < AA_TEXT) {
      warnings.push({
        field: 'primary',
        ratio: round(best),
        required: AA_TEXT,
        message: `Ningún texto se lee bien sobre el color principal (contraste ${round(best)}:1, mínimo ${AA_TEXT}:1). Usa un tono más oscuro o más claro.`,
      })
    }
  }

  const checks: { field: string; a: string; b: string; message: string }[] = [
    {
      field: 'text',
      a: theme.text,
      b: theme.background,
      message: 'El texto no se lee bien sobre el fondo',
    },
    {
      field: 'surface',
      a: theme.text,
      b: theme.surface,
      message: 'El texto no se lee bien sobre las tarjetas',
    },
    {
      field: 'secondary',
      a: theme.secondary,
      b: theme.surface,
      message: 'El color secundario no se lee bien sobre las tarjetas',
    },
  ]

  for (const check of checks) {
    const ratio = safeRatio(check.a, check.b)
    if (ratio === null || ratio >= AA_TEXT) continue
    warnings.push({
      field: check.field,
      ratio: round(ratio),
      required: AA_TEXT,
      message: `${check.message} (contraste ${round(ratio)}:1, mínimo ${AA_TEXT}:1).`,
    })
  }

  return { theme: { ...theme, onPrimary }, warnings }
}

// ---------------------------------------------------------------------------
// CSS variables
// ---------------------------------------------------------------------------

const BUTTON_RADIUS: Record<ThemeButtonStyle, string> = {
  pill: '999px',
  rounded: '12px',
  square: '4px',
}

const LETTER_SPACING: Record<ThemeLetterSpacing, string> = {
  tight: '-0.015em',
  normal: '0em',
  wide: '0.06em',
}

const DENSITY: Record<
  ThemeDensity,
  { padding: string; gap: string; section: string }
> = {
  compact: { padding: '0.75rem', gap: '0.5rem', section: '2.5rem' },
  comfortable: { padding: '1rem', gap: '0.75rem', section: '4rem' },
  spacious: { padding: '1.5rem', gap: '1.25rem', section: '6rem' },
}

const CARD_STYLE: Record<ThemeCardStyle, { shadow: string; border: string }> = {
  elevated: {
    shadow: 'var(--shadow-1)',
    border: '1px solid transparent',
  },
  flat: { shadow: 'none', border: '1px solid transparent' },
  outlined: {
    shadow: 'none',
    border: '1px solid color-mix(in oklch, var(--store-text) 14%, transparent)',
  },
  glass: {
    shadow: 'var(--shadow-2)',
    border: '1px solid color-mix(in oklch, var(--store-text) 10%, transparent)',
  },
}

const IMAGE_RATIO: Record<ThemeImageRatio, string> = {
  '1:1': '1 / 1',
  '4:3': '4 / 3',
  '3:2': '3 / 2',
  '16:9': '16 / 9',
}

const MOTION_DURATION: Record<ThemeMotion, string> = {
  full: '220ms',
  subtle: '120ms',
  none: '0ms',
}

const NOISE_TILE =
  "url(\"data:image/svg+xml,%3Csvg xmlns='http://www.w3.org/2000/svg' width='120' height='120'%3E%3Cfilter id='n'%3E%3CfeTurbulence type='fractalNoise' baseFrequency='0.85'/%3E%3C/filter%3E%3Crect width='120' height='120' filter='url(%23n)'/%3E%3C/svg%3E\")"

const INK = 'rgb(var(--store-text-rgb) / 1)'

const PATTERN: Record<ThemePattern, { image: string; size: string }> = {
  none: { image: 'none', size: 'auto' },
  dots: {
    image: `radial-gradient(${INK} 1px, transparent 1px)`,
    size: '16px 16px',
  },
  grid: {
    image: `linear-gradient(${INK} 1px, transparent 1px), linear-gradient(90deg, ${INK} 1px, transparent 1px)`,
    size: '24px 24px',
  },
  noise: { image: NOISE_TILE, size: '120px 120px' },
  diagonal: {
    image: `repeating-linear-gradient(45deg, ${INK} 0 1px, transparent 1px 10px)`,
    size: 'auto',
  },
  waves: {
    image: `radial-gradient(circle at 50% 100%, transparent 11px, ${INK} 11px 12px, transparent 12px)`,
    size: '32px 16px',
  },
}

/** `rounded` follows --store-radius; the rest are shapes in their own right. */
function imageRadius(theme: StoreTheme): string {
  switch (theme.imageShape) {
    case 'circle':
      return '999px'
    case 'squircle':
      return '30%'
    case 'arch':
      return `999px 999px ${theme.radius}px ${theme.radius}px`
    default:
      return `${theme.radius}px`
  }
}

/**
 * Maps a StoreTheme to the `--store-*` custom properties declared in
 * globals.css. Apply the result as an inline style on the store wrapper.
 * Everything here is skin: colour, pattern, shadow, density, ratio, shape and
 * motion, so components style themselves from variables instead of props.
 */
export function themeToCssVars(theme: StoreTheme): Record<string, string> {
  const density = DENSITY[theme.density]
  const card = CARD_STYLE[theme.cardStyle]
  const pattern = PATTERN[theme.pattern]

  return {
    '--store-primary': theme.primary,
    '--store-primary-rgb': hexToRgb(theme.primary) ?? '0 0 0',
    '--store-on-primary': theme.onPrimary,
    '--store-on-primary-rgb': hexToRgb(theme.onPrimary) ?? '255 255 255',
    '--store-secondary': theme.secondary,
    '--store-secondary-rgb': hexToRgb(theme.secondary) ?? '0 0 0',
    '--store-accent': theme.accent,
    '--store-accent-rgb': hexToRgb(theme.accent) ?? '0 0 0',
    '--store-background': theme.background,
    '--store-background-rgb': hexToRgb(theme.background) ?? '255 255 255',
    '--store-surface': theme.surface,
    '--store-surface-rgb': hexToRgb(theme.surface) ?? '255 255 255',
    '--store-text': theme.text,
    '--store-text-rgb': hexToRgb(theme.text) ?? '0 0 0',
    '--store-gradient': theme.gradient.enabled
      ? `linear-gradient(${theme.gradient.angle}deg, ${theme.gradient.from}, ${theme.gradient.to})`
      : 'none',
    '--store-pattern-image': pattern.image,
    '--store-pattern-size': pattern.size,
    '--store-pattern-opacity': String(theme.patternOpacity),
    '--store-radius': `${theme.radius}px`,
    '--store-button-radius': BUTTON_RADIUS[theme.buttonStyle],
    '--store-font-display': fontFamilyStack(theme.fontDisplay),
    '--store-font-body': fontFamilyStack(theme.fontBody),
    '--store-heading-weight': String(theme.headingWeight),
    '--store-heading-case':
      theme.headingCase === 'uppercase' ? 'uppercase' : 'none',
    '--store-letter-spacing': LETTER_SPACING[theme.letterSpacing],
    '--store-density-padding': density.padding,
    '--store-density-gap': density.gap,
    '--store-density-section': density.section,
    '--store-card-shadow': card.shadow,
    '--store-card-border': card.border,
    '--store-image-ratio': IMAGE_RATIO[theme.imageRatio],
    '--store-image-radius': imageRadius(theme),
    '--store-motion-duration': MOTION_DURATION[theme.motion],
    '--store-banner-overlay': String(theme.banner.overlayOpacity),
  }
}
