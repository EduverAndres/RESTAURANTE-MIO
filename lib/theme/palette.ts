/**
 * Smart palettes.
 *
 * Given the one colour a merchant actually cares about — the brand primary —
 * this proposes three complete, readable palettes. Every derived colour is
 * computed in OKLCH (see lib/theme/oklch) so the neighbours keep the apparent
 * lightness of the original instead of drifting.
 *
 * Pure and deterministic: the same primary always yields the same three
 * palettes, which is what makes the suggestions testable and what keeps the
 * editor from reshuffling itself while the merchant is looking at it.
 */

import { contrastRatio } from '@/lib/color/contrast'
import { normalizeHex } from '@/lib/theme'
import {
  hexToOklch,
  oklchToHex,
  rotateHue,
  withChroma,
  withLightness,
  type Oklch,
} from '@/lib/theme/oklch'
import { DEFAULT_STORE_THEME, type ThemeMode } from '@/types/app'

export const PALETTE_KINDS = [
  'complementary',
  'analogous',
  'monochromatic',
] as const
export type PaletteKind = (typeof PALETTE_KINDS)[number]

/** The six colour fields a suggestion fills in. */
export interface PaletteColors {
  primary: string
  secondary: string
  accent: string
  background: string
  surface: string
  text: string
}

export interface PaletteContrast {
  textOnBackground: number
  textOnSurface: number
  onPrimary: number
}

export interface PaletteSuggestion {
  kind: PaletteKind
  /** Neutral Spanish, shown on the suggestion card. */
  label: string
  description: string
  colors: PaletteColors
  /** The ink the storefront will use on the primary; never merchant-chosen. */
  onPrimary: string
  contrast: PaletteContrast
  /** True when every ratio in `contrast` clears WCAG AA for body copy. */
  passesAA: boolean
}

/** WCAG AA for body copy. */
const AA_TEXT = 4.5

const NEAR_WHITE = '#ffffff'
const NEAR_BLACK = '#1c1917'

const LABELS: Record<PaletteKind, { label: string; description: string }> = {
  complementary: {
    label: 'Complementaria',
    description:
      'Un tono opuesto al principal: mucho contraste, ideal para llamar la atención.',
  },
  analogous: {
    label: 'Análoga',
    description:
      'Tonos vecinos al principal: se ve tranquila y muy fácil de combinar.',
  },
  monochromatic: {
    label: 'Monocromática',
    description:
      'Un solo tono en varias intensidades: sobria, elegante y sin ruido.',
  },
}

/** A neutral primary has no hue to rotate; anchor the harmonies on warm 30°. */
const NEUTRAL_CHROMA = 0.02
const NEUTRAL_FALLBACK_HUE = 30

/** How the neutrals sit in each mode: lightness plus a whisper of the brand. */
const NEUTRALS: Record<
  'light' | 'dark',
  { background: number; surface: number; text: number; tint: number }
> = {
  light: { background: 0.972, surface: 0.995, text: 0.24, tint: 0.008 },
  dark: { background: 0.17, surface: 0.225, text: 0.93, tint: 0.012 },
}

function round(ratio: number): number {
  return Math.round(ratio * 100) / 100
}

/** Whichever of near-white / near-black reads better on `background`. */
function pickInk(background: string): string {
  return contrastRatio(NEAR_WHITE, background) >=
    contrastRatio(NEAR_BLACK, background)
    ? NEAR_WHITE
    : NEAR_BLACK
}

/** `auto` previews as light; the dark ramp is applied by globals.css. */
function neutralsFor(mode: ThemeMode): 'light' | 'dark' {
  return mode === 'dark' ? 'dark' : 'light'
}

function buildNeutrals(
  base: Oklch,
  mode: ThemeMode,
): Pick<PaletteColors, 'background' | 'surface' | 'text'> {
  const ramp = NEUTRALS[neutralsFor(mode)]
  const tinted = (lightness: number, tint: number): string =>
    oklchToHex(withChroma(withLightness(base, lightness), tint))
  return {
    background: tinted(ramp.background, ramp.tint),
    surface: tinted(ramp.surface, ramp.tint * 0.5),
    text: tinted(ramp.text, ramp.tint * 1.5),
  }
}

/** Derived brand colours, one recipe per harmony. */
function buildBrand(
  base: Oklch,
  kind: PaletteKind,
  mode: ThemeMode,
): Pick<PaletteColors, 'secondary' | 'accent'> {
  const dark = neutralsFor(mode) === 'dark'
  // Secondary is a supporting ink on cards, so it stays deliberately deeper
  // (or lighter in dark mode) than the primary; the accent stays vivid.
  const support = dark ? Math.max(base.l, 0.72) : Math.min(base.l, 0.42)
  const vivid = dark
    ? Math.max(base.l, 0.76)
    : Math.min(Math.max(base.l, 0.62), 0.8)

  switch (kind) {
    case 'complementary':
      return {
        secondary: oklchToHex(
          withChroma(
            withLightness(rotateHue(base, 180), support),
            base.c * 0.8,
          ),
        ),
        accent: oklchToHex(
          withChroma(withLightness(rotateHue(base, 150), vivid), base.c * 1.1),
        ),
      }
    case 'analogous':
      return {
        secondary: oklchToHex(
          withChroma(
            withLightness(rotateHue(base, -32), support),
            base.c * 0.85,
          ),
        ),
        accent: oklchToHex(
          withChroma(withLightness(rotateHue(base, 34), vivid), base.c * 1.15),
        ),
      }
    default:
      return {
        secondary: oklchToHex(
          withChroma(withLightness(base, support), base.c * 0.9),
        ),
        accent: oklchToHex(
          withChroma(withLightness(base, vivid), base.c * 0.6),
        ),
      }
  }
}

function describe(kind: PaletteKind, colors: PaletteColors): PaletteSuggestion {
  const onPrimary = pickInk(colors.primary)
  const contrast: PaletteContrast = {
    textOnBackground: round(contrastRatio(colors.text, colors.background)),
    textOnSurface: round(contrastRatio(colors.text, colors.surface)),
    onPrimary: round(contrastRatio(onPrimary, colors.primary)),
  }
  return {
    kind,
    ...LABELS[kind],
    colors,
    onPrimary,
    contrast,
    passesAA: Object.values(contrast).every((ratio) => ratio >= AA_TEXT),
  }
}

/**
 * Three palettes built around `primary`, one per harmony, always in the order
 * of `PALETTE_KINDS`. An unreadable primary falls back to the platform default
 * so the editor always has something to show.
 */
export function generatePalettes(
  primary: string,
  mode: ThemeMode = 'light',
): PaletteSuggestion[] {
  const hex =
    normalizeHex(primary) ?? normalizeHex(DEFAULT_STORE_THEME.primary)!
  const parsed = hexToOklch(hex)
  const base: Oklch =
    parsed.c < NEUTRAL_CHROMA
      ? { ...parsed, c: NEUTRAL_CHROMA * 3, h: NEUTRAL_FALLBACK_HUE }
      : parsed

  const neutrals = buildNeutrals(base, mode)
  return PALETTE_KINDS.map((kind) =>
    describe(kind, {
      primary: hex,
      ...buildBrand(base, kind, mode),
      ...neutrals,
    }),
  )
}
