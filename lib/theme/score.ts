/**
 * Accessibility audit for a store theme.
 *
 * Five checks, a weighted 0–100 score and a one-click fix for each of them.
 * The contrast maths is not re-implemented here: it comes from
 * `contrastRatio` in lib/color/contrast, the same function `ensureReadable`
 * uses, so the editor panel and the storefront can never disagree.
 *
 * Two of the checks are not about contrast:
 *
 * - `touch-target` reads `density`, which is the only lever in the theme that
 *   changes how tall a button, chip or row ends up. `compact` drives the
 *   padding to 0.75rem, which puts a standard control just under the 44px
 *   comfortable target, so it earns a warning rather than a failure.
 * - `heading-legibility` reads `headingCase` and `letterSpacing`. The theme has
 *   no font-size field — the storefront's type scale is fixed in globals.css —
 *   so the legibility risk a merchant can actually create is uppercase set on
 *   tight tracking, which is measurably harder to read than either alone.
 *
 * Everything here is pure and deterministic.
 */

import { contrastRatio } from '@/lib/color/contrast'
import { hexToOklch, oklchToHex, withLightness } from '@/lib/theme/oklch'
import type { StoreTheme } from '@/types/app'

export const ACCESSIBILITY_CHECK_IDS = [
  'text-background',
  'text-surface',
  'on-primary',
  'touch-target',
  'heading-legibility',
] as const
export type AccessibilityCheckId = (typeof ACCESSIBILITY_CHECK_IDS)[number]

export type CheckStatus = 'pass' | 'warn' | 'fail'

export interface AccessibilityCheck {
  id: AccessibilityCheckId
  /** Neutral Spanish, read out by the panel. */
  label: string
  detail: string
  status: CheckStatus
  /** Present on the contrast checks only. */
  ratio?: number
  required?: number
  /** Share of the 100 point score this check is worth. */
  weight: number
  /** True when `applyAccessibilityFix` would change something. */
  fixable: boolean
}

export interface AccessibilityReport {
  score: number
  checks: AccessibilityCheck[]
}

/** WCAG AA for body copy. */
const AA_TEXT = 4.5

const NEAR_WHITE = '#ffffff'
const NEAR_BLACK = '#1c1917'

const WEIGHTS: Record<AccessibilityCheckId, number> = {
  'text-background': 25,
  'text-surface': 25,
  'on-primary': 20,
  'touch-target': 15,
  'heading-legibility': 15,
}

const STATUS_FACTOR: Record<CheckStatus, number> = {
  pass: 1,
  warn: 0.5,
  fail: 0,
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

/** The better of the two inks the storefront may put on `background`. */
function bestInkRatio(background: string): number {
  return Math.max(
    safeRatio(NEAR_WHITE, background) ?? 0,
    safeRatio(NEAR_BLACK, background) ?? 0,
  )
}

// ---------------------------------------------------------------------------
// Checks
// ---------------------------------------------------------------------------

function contrastCheck(
  id: 'text-background' | 'text-surface',
  label: string,
  ink: string,
  ground: string,
  passDetail: string,
  failDetail: (ratio: string) => string,
): AccessibilityCheck {
  const ratio = safeRatio(ink, ground)
  const status: CheckStatus =
    ratio !== null && ratio >= AA_TEXT ? 'pass' : 'fail'
  return {
    id,
    label,
    status,
    ratio: ratio === null ? undefined : round(ratio),
    required: AA_TEXT,
    weight: WEIGHTS[id],
    fixable: status !== 'pass',
    detail:
      status === 'pass'
        ? passDetail
        : failDetail(ratio === null ? '—' : `${round(ratio)}`),
  }
}

function checkTextBackground(theme: StoreTheme): AccessibilityCheck {
  return contrastCheck(
    'text-background',
    'Texto sobre el fondo',
    theme.text,
    theme.background,
    'El texto se lee con claridad sobre el fondo.',
    (ratio) =>
      `El contraste es de ${ratio}:1 y el mínimo recomendado es 4.5:1. Oscurece el texto o aclara el fondo.`,
  )
}

function checkTextSurface(theme: StoreTheme): AccessibilityCheck {
  return contrastCheck(
    'text-surface',
    'Texto sobre las tarjetas',
    theme.text,
    theme.surface,
    'El texto se lee con claridad dentro de las tarjetas.',
    (ratio) =>
      `El contraste dentro de las tarjetas es de ${ratio}:1 y el mínimo recomendado es 4.5:1.`,
  )
}

function checkOnPrimary(theme: StoreTheme): AccessibilityCheck {
  const ratio = bestInkRatio(theme.primary)
  const status: CheckStatus = ratio >= AA_TEXT ? 'pass' : 'fail'
  return {
    id: 'on-primary',
    label: 'Texto sobre el color principal',
    status,
    ratio: round(ratio),
    required: AA_TEXT,
    weight: WEIGHTS['on-primary'],
    fixable: status !== 'pass',
    detail:
      status === 'pass'
        ? 'Los botones principales se leen bien.'
        : `Ningún texto se lee bien sobre el color principal (mejor caso ${round(ratio)}:1). Usa un tono más oscuro o más claro.`,
  }
}

function checkTouchTarget(theme: StoreTheme): AccessibilityCheck {
  const tight = theme.density === 'compact'
  return {
    id: 'touch-target',
    label: 'Tamaño de los botones',
    status: tight ? 'warn' : 'pass',
    weight: WEIGHTS['touch-target'],
    fixable: tight,
    detail: tight
      ? 'Con la densidad compacta los botones quedan por debajo de los 44 px recomendados para tocar con el dedo.'
      : 'Los botones y las tarjetas tienen espacio suficiente para tocarlos sin equivocarse.',
  }
}

function checkHeadingLegibility(theme: StoreTheme): AccessibilityCheck {
  const risky =
    theme.headingCase === 'uppercase' && theme.letterSpacing === 'tight'
  return {
    id: 'heading-legibility',
    label: 'Legibilidad de los títulos',
    status: risky ? 'warn' : 'pass',
    weight: WEIGHTS['heading-legibility'],
    fixable: risky,
    detail: risky
      ? 'Los títulos en mayúsculas con el espaciado estrecho cuestan de leer. Abre el espaciado entre letras.'
      : 'Los títulos tienen un espaciado cómodo de leer.',
  }
}

const CHECKS: Record<
  AccessibilityCheckId,
  (theme: StoreTheme) => AccessibilityCheck
> = {
  'text-background': checkTextBackground,
  'text-surface': checkTextSurface,
  'on-primary': checkOnPrimary,
  'touch-target': checkTouchTarget,
  'heading-legibility': checkHeadingLegibility,
}

/**
 * Runs every check, always in the order of `ACCESSIBILITY_CHECK_IDS`, and
 * scores the theme out of 100: a passing check earns its full weight, a
 * warning half of it, a failure none.
 */
export function auditTheme(theme: StoreTheme): AccessibilityReport {
  const checks = ACCESSIBILITY_CHECK_IDS.map((id) => CHECKS[id](theme))
  const score = checks.reduce(
    (total, check) => total + check.weight * STATUS_FACTOR[check.status],
    0,
  )
  return { score: Math.round(score), checks }
}

// ---------------------------------------------------------------------------
// Fixes
// ---------------------------------------------------------------------------

/** Binary search steps; 18 resolves lightness far finer than 8-bit output. */
const SEARCH_STEPS = 18

/**
 * The nearest lightness of `ink` (same hue and chroma) that clears AA against
 * `ground`, moving in whichever direction has room. Returns the original when
 * neither direction can get there.
 */
function readableInk(ink: string, ground: string): string {
  let base
  try {
    base = hexToOklch(ink)
  } catch {
    base = hexToOklch(NEAR_BLACK)
  }
  const darkerFirst =
    (safeRatio(NEAR_BLACK, ground) ?? 0) >= (safeRatio(NEAR_WHITE, ground) ?? 0)
  const target = darkerFirst ? 0 : 1

  // Binary search the closest lightness to the original that still passes.
  let near = base.l
  let far = target
  let best: string | null = null
  for (let step = 0; step < SEARCH_STEPS; step += 1) {
    const mid = (near + far) / 2
    const candidate = oklchToHex(withLightness(base, mid))
    if ((safeRatio(candidate, ground) ?? 0) >= AA_TEXT) {
      best = candidate
      far = mid
    } else {
      near = mid
    }
  }
  const endpoint = oklchToHex(withLightness(base, target))
  if ((safeRatio(endpoint, ground) ?? 0) >= AA_TEXT) return best ?? endpoint
  return best ?? ink
}

/**
 * The nearest primary (same hue and chroma) on which one of the two inks
 * clears AA. Tries darker and lighter and keeps whichever moves less.
 */
function readablePrimary(primary: string): string {
  let base
  try {
    base = hexToOklch(primary)
  } catch {
    return primary
  }

  const search = (target: number): { hex: string; distance: number } | null => {
    let near = base.l
    let far = target
    let best: { hex: string; distance: number } | null = null
    for (let step = 0; step < SEARCH_STEPS; step += 1) {
      const mid = (near + far) / 2
      const candidate = oklchToHex(withLightness(base, mid))
      if (bestInkRatio(candidate) >= AA_TEXT) {
        best = { hex: candidate, distance: Math.abs(mid - base.l) }
        far = mid
      } else {
        near = mid
      }
    }
    return best
  }

  const options = [search(0), search(1)].filter(
    (option): option is { hex: string; distance: number } => option !== null,
  )
  if (options.length === 0) return primary
  options.sort((a, b) => a.distance - b.distance)
  return options[0].hex
}

const FIXES: Record<AccessibilityCheckId, (theme: StoreTheme) => StoreTheme> = {
  'text-background': (theme) => ({
    ...theme,
    text: readableInk(theme.text, theme.background),
  }),
  'text-surface': (theme) => ({
    ...theme,
    text: readableInk(theme.text, theme.surface),
  }),
  'on-primary': (theme) => ({
    ...theme,
    primary: readablePrimary(theme.primary),
  }),
  'touch-target': (theme) => ({ ...theme, density: 'comfortable' }),
  'heading-legibility': (theme) => ({ ...theme, letterSpacing: 'normal' }),
}

/**
 * Applies the one-click fix for a single check. A check that already passes is
 * left alone, so running a fix twice never drifts the theme.
 */
export function applyAccessibilityFix(
  theme: StoreTheme,
  id: AccessibilityCheckId,
): StoreTheme {
  if (CHECKS[id](theme).status === 'pass') return theme
  return FIXES[id](theme)
}

/** How many times the fixes are re-applied before giving up on a perfect score. */
const FIX_PASSES = 4

/**
 * Applies every available fix. Repeats until the score stops improving,
 * because fixing the text for the cards can move it away from the background
 * (and the other way round) when the two grounds are far apart.
 */
export function applyAllAccessibilityFixes(theme: StoreTheme): StoreTheme {
  let current = theme
  for (let pass = 0; pass < FIX_PASSES; pass += 1) {
    let next = current
    for (const id of ACCESSIBILITY_CHECK_IDS) {
      next = applyAccessibilityFix(next, id)
    }
    if (JSON.stringify(next) === JSON.stringify(current)) break
    current = next
  }
  return current
}
