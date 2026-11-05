import { describe, expect, it } from 'vitest'
import { normalizeTheme } from '@/lib/theme'
import { checkThemeForPlan, themeForPlan } from '@/lib/theme/plan-gate'
import { applyPreset, findPreset } from '@/lib/theme/presets'
import { DEFAULT_STORE_THEME, type StoreTheme } from '@/types/app'

const current: StoreTheme = normalizeTheme({
  ...DEFAULT_STORE_THEME,
  logoUrl: 'https://x/logo.png',
  hero: { ...DEFAULT_STORE_THEME.hero, tagline: 'Arepas de verdad' },
})

describe('themeForPlan', () => {
  const vipOnly: StoreTheme = {
    ...current,
    customCss: '.x { color: red }',
    hero: { ...current.hero, videoUrl: 'https://x/hero.mp4' },
    banner: { ...current.banner, layout: 'video' },
  }

  it('keeps custom CSS and the hero video on VIP', () => {
    expect(themeForPlan(vipOnly, 'vip')).toEqual(vipOnly)
  })

  it('drops them below VIP, falling back to the full banner', () => {
    for (const plan of ['normal', 'mediano'] as const) {
      const theme = themeForPlan(vipOnly, plan)
      expect(theme.customCss, plan).toBeNull()
      expect(theme.hero.videoUrl, plan).toBeNull()
      expect(theme.banner.layout, plan).toBe('full')
    }
  })
})

describe('checkThemeForPlan on Normal', () => {
  it('lets the merchant change content: logo, cover, tagline, story, socials', () => {
    const next: StoreTheme = {
      ...current,
      logoUrl: 'https://x/otro-logo.png',
      banner: { ...current.banner, imageUrl: 'https://x/portada.jpg' },
      hero: { ...current.hero, tagline: 'Desde 1998', ctaLabel: 'Pedir' },
      social: { ...current.social, instagram: '@arepas' },
      footer: { ...current.footer, text: 'Gracias por pedir' },
    }
    expect(checkThemeForPlan(next, current, 'normal')).toEqual({
      ok: true,
      theme: next,
    })
  })

  it('accepts any of the ready-made looks', () => {
    const asadero = findPreset('asadero')!
    const next = applyPreset(current, asadero)
    expect(checkThemeForPlan(next, current, 'normal').ok).toBe(true)
  })

  it('refuses a hand-picked colour or font', () => {
    for (const next of [
      { ...current, primary: '#123456' },
      { ...current, fontDisplay: 'Playfair Display' as const },
      { ...current, radius: current.radius + 4 },
    ]) {
      const result = checkThemeForPlan(next, current, 'normal')
      expect(result.ok).toBe(false)
      if (!result.ok) expect(result.error).toContain('Mediano')
    }
  })

  it('keeps a look the store already had, even if no preset matches it', () => {
    const custom = { ...current, primary: '#123456' }
    const next = { ...custom, logoUrl: 'https://x/nuevo.png' }
    expect(checkThemeForPlan(next, custom, 'normal').ok).toBe(true)
  })

  it('ignores the ink the editor recomputes on the brand colour', () => {
    const next = {
      ...current,
      onPrimary: current.onPrimary === '#ffffff' ? '#1c1917' : '#ffffff',
      logoUrl: 'https://x/nuevo.png',
    }
    expect(checkThemeForPlan(next, current, 'normal').ok).toBe(true)
  })

  it('does not care about key order in what the editor sends', () => {
    const reverse = <T extends object>(value: T): T =>
      Object.fromEntries(Object.entries(value).reverse()) as T
    const reordered = {
      ...reverse(current),
      hero: reverse(current.hero),
      banner: reverse(current.banner),
    }
    expect(checkThemeForPlan(reordered, current, 'normal').ok).toBe(true)
  })
})

describe('checkThemeForPlan on Mediano and VIP', () => {
  it('lets Mediano change the whole look but strips VIP-only extras', () => {
    const next: StoreTheme = {
      ...current,
      primary: '#123456',
      customCss: '.x { color: red }',
    }
    const result = checkThemeForPlan(next, current, 'mediano')
    expect(result.ok).toBe(true)
    if (result.ok) {
      expect(result.theme.primary).toBe('#123456')
      expect(result.theme.customCss).toBeNull()
    }
  })

  it('lets VIP keep everything', () => {
    const next: StoreTheme = { ...current, customCss: '.x { color: red }' }
    expect(checkThemeForPlan(next, current, 'vip')).toEqual({
      ok: true,
      theme: next,
    })
  })
})
