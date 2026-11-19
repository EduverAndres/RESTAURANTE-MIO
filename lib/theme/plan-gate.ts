// What each plan may do to a storefront's theme. Pure, so the same rules run
// in the save action, in the storefront and in tests.
import { planHas, type PlanId } from '@/lib/plans'
import { applyPreset, THEME_PRESETS } from '@/lib/theme/presets'
import { DEFAULT_STORE_THEME, type StoreTheme } from '@/types/app'

export const NORMAL_PLAN_THEME_ERROR =
  'Con el plan Normal eliges entre los temas listos y cambias logo, portada y textos. Para escoger colores, tipografías o secciones a tu gusto, pasa al plan Mediano.'

/**
 * The theme a plan is allowed to show. VIP-only extras (custom CSS and the
 * hero video) are removed below VIP, so a store that moves down a plan stops
 * using them without anyone editing its theme. The banner falls back from
 * the video layout to the full image one.
 */
export function themeForPlan(theme: StoreTheme, plan: PlanId): StoreTheme {
  const css = planHas(plan, 'custom-css')
  const video = planHas(plan, 'hero-video')
  if (css && video) return theme
  return {
    ...theme,
    customCss: css ? theme.customCss : null,
    hero: video ? theme.hero : { ...theme.hero, videoUrl: null },
    banner:
      video || theme.banner.layout !== 'video'
        ? theme.banner
        : { ...theme.banner, layout: 'full' },
  }
}

/** JSON with sorted keys, so two equal themes compare equal as strings. */
function stableStringify(value: unknown): string {
  if (Array.isArray(value)) return `[${value.map(stableStringify).join(',')}]`
  if (value && typeof value === 'object') {
    const entries = Object.entries(value as Record<string, unknown>).sort(
      ([a], [b]) => a.localeCompare(b),
    )
    return `{${entries
      .map(([key, entry]) => `${JSON.stringify(key)}:${stableStringify(entry)}`)
      .join(',')}}`
  }
  return JSON.stringify(value)
}

/**
 * The theme minus everything a merchant writes or uploads: what is left is
 * the "look". Normal can change content freely; its look has to be one it
 * already had, a ready-made preset, or the default.
 */
function lookOf(theme: StoreTheme): string {
  return stableStringify({
    ...theme,
    // Derived, never chosen: the editor recomputes it on save
    // (`ensureReadable`), so an old theme may differ only here.
    onPrimary: null,
    logoUrl: null,
    customCss: null,
    banner: { ...theme.banner, imageUrl: null },
    hero: { ...theme.hero, tagline: null, ctaLabel: null, videoUrl: null },
    featured: { ...theme.featured, title: '', productIds: [] },
    story: null,
    social: null,
    footer: { ...theme.footer, text: null },
  })
}

export type PlanThemeCheck =
  { ok: true; theme: StoreTheme } | { ok: false; error: string }

/**
 * Whether `next` may be saved over `current` on `plan`, and the theme to
 * save. VIP-only extras are stripped rather than refused, so a store that
 * moved down a plan can still save its other changes.
 */
export function checkThemeForPlan(
  next: StoreTheme,
  current: StoreTheme,
  plan: PlanId,
): PlanThemeCheck {
  const theme = themeForPlan(next, plan)
  if (planHas(plan, 'theme-editor')) return { ok: true, theme }

  const look = lookOf(theme)
  const allowed = [
    current,
    DEFAULT_STORE_THEME,
    ...THEME_PRESETS.map((preset) => applyPreset(current, preset)),
  ]
  return allowed.some(
    (candidate) => lookOf(themeForPlan(candidate, plan)) === look,
  )
    ? { ok: true, theme }
    : { ok: false, error: NORMAL_PLAN_THEME_ERROR }
}
