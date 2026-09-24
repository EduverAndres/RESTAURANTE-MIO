import { describe, expect, it } from 'vitest'
import {
  THEME_BANNER_LAYOUT_LABELS,
  THEME_CARD_STYLE_LABELS,
  THEME_CATEGORY_NAV_LABELS,
  THEME_DENSITY_LABELS,
  THEME_IMAGE_SHAPE_LABELS,
  THEME_MENU_LAYOUT_LABELS,
  THEME_MOTION_LABELS,
  THEME_PATTERN_LABELS,
  THEME_SECTION_LABELS,
  moveSection,
  storeThemeSchema,
} from '@/lib/validations/theme'
import {
  DEFAULT_STORE_THEME,
  THEME_BANNER_LAYOUTS,
  THEME_CARD_STYLES,
  THEME_CATEGORY_NAVS,
  THEME_DENSITIES,
  THEME_IMAGE_SHAPES,
  THEME_MENU_LAYOUTS,
  THEME_MOTIONS,
  THEME_PATTERNS,
  THEME_SECTIONS,
} from '@/types/app'

/** The v1 theme shape, as stored by every store created before this phase. */
const LEGACY_THEME = {
  primary: '#c2410c',
  accent: '#f59e0b',
  background: '#fbf8f3',
  surface: '#ffffff',
  text: '#1c1917',
  radius: 20,
  fontDisplay: 'Fraunces',
  fontBody: 'Inter',
  banner: { imageUrl: null, overlayOpacity: 0.35, layout: 'full' },
  logoUrl: null,
  sectionOrder: ['hero', 'featured', 'menu', 'reviews', 'info'],
  buttonStyle: 'pill',
}

describe('storeThemeSchema', () => {
  it('accepts the default theme unchanged', () => {
    const result = storeThemeSchema.safeParse(DEFAULT_STORE_THEME)
    expect(result.success).toBe(true)
    if (result.success) expect(result.data).toEqual(DEFAULT_STORE_THEME)
  })

  it('accepts lowercase hex colors from the native color input', () => {
    expect(
      storeThemeSchema.safeParse({ ...DEFAULT_STORE_THEME, primary: '#c2410c' })
        .success,
    ).toBe(true)
  })

  it('rejects malformed hex colors', () => {
    for (const primary of ['red', '#12', 'C2410C', '#GGGGGG', '#fff']) {
      expect(
        storeThemeSchema.safeParse({ ...DEFAULT_STORE_THEME, primary }).success,
      ).toBe(false)
    }
  })

  it('rejects unknown fonts, button styles and banner layouts', () => {
    expect(
      storeThemeSchema.safeParse({ ...DEFAULT_STORE_THEME, fontBody: 'Comic' })
        .success,
    ).toBe(false)
    expect(
      storeThemeSchema.safeParse({
        ...DEFAULT_STORE_THEME,
        buttonStyle: 'blob',
      }).success,
    ).toBe(false)
    expect(
      storeThemeSchema.safeParse({
        ...DEFAULT_STORE_THEME,
        banner: { ...DEFAULT_STORE_THEME.banner, layout: 'wide' },
      }).success,
    ).toBe(false)
  })

  it('requires every section exactly once in sectionOrder', () => {
    expect(
      storeThemeSchema.safeParse({
        ...DEFAULT_STORE_THEME,
        sectionOrder: ['menu', 'hero', 'info', 'reviews', 'featured'],
      }).success,
    ).toBe(true)
    expect(
      storeThemeSchema.safeParse({
        ...DEFAULT_STORE_THEME,
        sectionOrder: ['hero', 'menu'],
      }).success,
    ).toBe(false)
    expect(
      storeThemeSchema.safeParse({
        ...DEFAULT_STORE_THEME,
        sectionOrder: ['hero', 'hero', 'featured', 'menu', 'reviews', 'info'],
      }).success,
    ).toBe(false)
  })

  it('bounds radius and overlay opacity', () => {
    expect(
      storeThemeSchema.safeParse({ ...DEFAULT_STORE_THEME, radius: 65 })
        .success,
    ).toBe(false)
    expect(
      storeThemeSchema.safeParse({
        ...DEFAULT_STORE_THEME,
        banner: { ...DEFAULT_STORE_THEME.banner, overlayOpacity: 1.5 },
      }).success,
    ).toBe(false)
  })
})

// ---------------------------------------------------------------------------
// v2 theme fields
// ---------------------------------------------------------------------------

describe('storeThemeSchema v2', () => {
  it('accepts a legacy v1 theme and fills every new field from its default', () => {
    const result = storeThemeSchema.safeParse(LEGACY_THEME)
    expect(result.success).toBe(true)
    if (!result.success) return
    expect(result.data.mode).toBe(DEFAULT_STORE_THEME.mode)
    expect(result.data.pattern).toBe(DEFAULT_STORE_THEME.pattern)
    expect(result.data.hero).toEqual(DEFAULT_STORE_THEME.hero)
    expect(result.data.badges).toEqual(DEFAULT_STORE_THEME.badges)
    expect(result.data.social).toEqual(DEFAULT_STORE_THEME.social)
    expect(result.data.customCss).toBeNull()
  })

  it('accepts a partially filled nested group', () => {
    const result = storeThemeSchema.safeParse({
      ...LEGACY_THEME,
      hero: { align: 'center' },
      gradient: { enabled: true },
    })
    expect(result.success).toBe(true)
    if (!result.success) return
    expect(result.data.hero.align).toBe('center')
    expect(result.data.hero.logoSize).toBe(DEFAULT_STORE_THEME.hero.logoSize)
    expect(result.data.gradient.angle).toBe(DEFAULT_STORE_THEME.gradient.angle)
  })

  it('rejects an invalid value for every new enum', () => {
    const invalid: Record<string, unknown> = {
      mode: 'neon',
      pattern: 'zigzag',
      headingWeight: 350,
      headingCase: 'title',
      letterSpacing: 'huge',
      density: 'tiny',
      cardStyle: 'blob',
      imageRatio: '2:1',
      imageShape: 'star',
      menuLayout: 'table',
      categoryNav: 'dropdown',
      productHover: 'spin',
      showPrices: 'never',
      motion: 'turbo',
    }
    for (const [key, value] of Object.entries(invalid)) {
      expect(
        storeThemeSchema.safeParse({ ...DEFAULT_STORE_THEME, [key]: value })
          .success,
      ).toBe(false)
    }
    expect(
      storeThemeSchema.safeParse({
        ...DEFAULT_STORE_THEME,
        badges: { ...DEFAULT_STORE_THEME.badges, style: 'ghost' },
      }).success,
    ).toBe(false)
    expect(
      storeThemeSchema.safeParse({
        ...DEFAULT_STORE_THEME,
        featured: { ...DEFAULT_STORE_THEME.featured, layout: 'grid' },
      }).success,
    ).toBe(false)
    expect(
      storeThemeSchema.safeParse({
        ...DEFAULT_STORE_THEME,
        hero: { ...DEFAULT_STORE_THEME.hero, logoSize: 'xl' },
      }).success,
    ).toBe(false)
  })

  it('accepts the banner layouts added in this phase', () => {
    for (const layout of ['editorial', 'video', 'full', 'split', 'compact']) {
      expect(
        storeThemeSchema.safeParse({
          ...DEFAULT_STORE_THEME,
          banner: { ...DEFAULT_STORE_THEME.banner, layout },
        }).success,
      ).toBe(true)
    }
  })

  it('accepts the opt-in sections added in this phase', () => {
    expect(
      storeThemeSchema.safeParse({
        ...DEFAULT_STORE_THEME,
        sectionOrder: ['hero', 'story', 'featured', 'menu', 'reviews', 'info'],
      }).success,
    ).toBe(true)
  })

  it('enforces numeric ranges at both bounds', () => {
    const bounded: [string, unknown, unknown, unknown, unknown][] = [
      ['patternOpacity', 0, 0.2, -0.01, 0.21],
      ['radius', 0, 64, -1, 65],
    ]
    for (const [key, low, high, tooLow, tooHigh] of bounded) {
      expect(
        storeThemeSchema.safeParse({ ...DEFAULT_STORE_THEME, [key]: low })
          .success,
      ).toBe(true)
      expect(
        storeThemeSchema.safeParse({ ...DEFAULT_STORE_THEME, [key]: high })
          .success,
      ).toBe(true)
      expect(
        storeThemeSchema.safeParse({ ...DEFAULT_STORE_THEME, [key]: tooLow })
          .success,
      ).toBe(false)
      expect(
        storeThemeSchema.safeParse({ ...DEFAULT_STORE_THEME, [key]: tooHigh })
          .success,
      ).toBe(false)
    }
  })

  it('bounds the gradient angle and the badge age', () => {
    const gradient = (angle: number) => ({
      ...DEFAULT_STORE_THEME,
      gradient: { ...DEFAULT_STORE_THEME.gradient, angle },
    })
    expect(storeThemeSchema.safeParse(gradient(0)).success).toBe(true)
    expect(storeThemeSchema.safeParse(gradient(360)).success).toBe(true)
    expect(storeThemeSchema.safeParse(gradient(-1)).success).toBe(false)
    expect(storeThemeSchema.safeParse(gradient(361)).success).toBe(false)

    const badges = (newDays: number) => ({
      ...DEFAULT_STORE_THEME,
      badges: { ...DEFAULT_STORE_THEME.badges, newDays },
    })
    expect(storeThemeSchema.safeParse(badges(0)).success).toBe(true)
    expect(storeThemeSchema.safeParse(badges(365)).success).toBe(true)
    expect(storeThemeSchema.safeParse(badges(-1)).success).toBe(false)
    expect(storeThemeSchema.safeParse(badges(366)).success).toBe(false)
    expect(storeThemeSchema.safeParse(badges(7.5)).success).toBe(false)
  })

  it('caps the free text fields', () => {
    const hero = (patch: Record<string, unknown>) => ({
      ...DEFAULT_STORE_THEME,
      hero: { ...DEFAULT_STORE_THEME.hero, ...patch },
    })
    expect(
      storeThemeSchema.safeParse(hero({ tagline: 'a'.repeat(80) })).success,
    ).toBe(true)
    expect(
      storeThemeSchema.safeParse(hero({ tagline: 'a'.repeat(81) })).success,
    ).toBe(false)
    expect(
      storeThemeSchema.safeParse(hero({ ctaLabel: 'a'.repeat(25) })).success,
    ).toBe(false)
    expect(
      storeThemeSchema.safeParse({
        ...DEFAULT_STORE_THEME,
        story: { ...DEFAULT_STORE_THEME.story, text: 'a'.repeat(601) },
      }).success,
    ).toBe(false)
    expect(
      storeThemeSchema.safeParse({
        ...DEFAULT_STORE_THEME,
        footer: { ...DEFAULT_STORE_THEME.footer, text: 'a'.repeat(201) },
      }).success,
    ).toBe(false)
  })

  it('restricts the hero video to an https mp4', () => {
    const hero = (videoUrl: string | null) => ({
      ...DEFAULT_STORE_THEME,
      hero: { ...DEFAULT_STORE_THEME.hero, videoUrl },
    })
    expect(storeThemeSchema.safeParse(hero(null)).success).toBe(true)
    expect(
      storeThemeSchema.safeParse(hero('https://cdn.test/clip.mp4')).success,
    ).toBe(true)
    expect(
      storeThemeSchema.safeParse(hero('http://cdn.test/clip.mp4')).success,
    ).toBe(false)
    expect(
      storeThemeSchema.safeParse(hero('https://cdn.test/clip.mov')).success,
    ).toBe(false)
    expect(storeThemeSchema.safeParse(hero('not-a-url')).success).toBe(false)
  })

  it('accepts social handles and urls, and rejects the rest', () => {
    const social = (patch: Record<string, unknown>) => ({
      ...DEFAULT_STORE_THEME,
      social: { ...DEFAULT_STORE_THEME.social, ...patch },
    })
    expect(
      storeThemeSchema.safeParse(social({ instagram: '@arepa' })).success,
    ).toBe(true)
    expect(
      storeThemeSchema.safeParse(
        social({ tiktok: 'https://tiktok.com/@arepa' }),
      ).success,
    ).toBe(true)
    expect(
      storeThemeSchema.safeParse(social({ facebook: 'a'.repeat(65) })).success,
    ).toBe(false)
    expect(
      storeThemeSchema.safeParse(social({ instagram: 'no spaces here' }))
        .success,
    ).toBe(false)
  })

  it('sanitises custom css and caps it at 4 KB', () => {
    const parsed = storeThemeSchema.safeParse({
      ...DEFAULT_STORE_THEME,
      customCss: '@import "evil.css"; .promo { color: red }',
    })
    expect(parsed.success).toBe(true)
    if (!parsed.success) return
    expect(parsed.data.customCss).not.toBeNull()
    expect(parsed.data.customCss).not.toContain('@import')
    expect(parsed.data.customCss).toContain('[data-store-theme] .promo')

    expect(
      storeThemeSchema.safeParse({
        ...DEFAULT_STORE_THEME,
        customCss: 'a'.repeat(4097),
      }).success,
    ).toBe(false)
  })
})

describe('theme label maps', () => {
  it('covers every option the editor can offer', () => {
    const pairs: [Record<string, string>, readonly string[]][] = [
      [THEME_SECTION_LABELS, THEME_SECTIONS],
      [THEME_PATTERN_LABELS, THEME_PATTERNS],
      [THEME_DENSITY_LABELS, THEME_DENSITIES],
      [THEME_CARD_STYLE_LABELS, THEME_CARD_STYLES],
      [THEME_MENU_LAYOUT_LABELS, THEME_MENU_LAYOUTS],
      [THEME_CATEGORY_NAV_LABELS, THEME_CATEGORY_NAVS],
      [THEME_IMAGE_SHAPE_LABELS, THEME_IMAGE_SHAPES],
      [THEME_BANNER_LAYOUT_LABELS, THEME_BANNER_LAYOUTS],
      [THEME_MOTION_LABELS, THEME_MOTIONS],
    ]
    for (const [labels, options] of pairs) {
      expect(Object.keys(labels).sort()).toEqual([...options].sort())
      for (const option of options)
        expect(labels[option].length).toBeGreaterThan(0)
    }
  })
})

describe('moveSection', () => {
  it('swaps neighbours and ignores boundaries', () => {
    expect(
      moveSection(['hero', 'menu', 'info', 'featured'], 'menu', 'up'),
    ).toEqual(['menu', 'hero', 'info', 'featured'])
    expect(moveSection(['hero', 'menu'], 'hero', 'up')).toEqual([
      'hero',
      'menu',
    ])
  })
})
