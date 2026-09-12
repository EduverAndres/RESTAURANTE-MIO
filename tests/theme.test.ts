import { readFileSync } from 'node:fs'
import { join } from 'node:path'
import { describe, expect, it } from 'vitest'
import {
  contrastRatio,
  ensureReadable,
  hexToRgb,
  mergeTheme,
  normalizeTheme,
  themeToCssVars,
} from '@/lib/theme'
import { storeThemeSchema } from '@/lib/validations/theme'
import { DEFAULT_STORE_THEME } from '@/types/app'

describe('hexToRgb', () => {
  it('converts a six digit hex color to a space separated rgb triplet', () => {
    expect(hexToRgb('#C2410C')).toBe('194 65 12')
    expect(hexToRgb('#ffffff')).toBe('255 255 255')
  })

  it('accepts a three digit shorthand', () => {
    expect(hexToRgb('#fff')).toBe('255 255 255')
    expect(hexToRgb('#0af')).toBe('0 170 255')
  })

  it('accepts colors without the leading hash', () => {
    expect(hexToRgb('1C1917')).toBe('28 25 23')
  })

  it('returns null for invalid input', () => {
    expect(hexToRgb('#12')).toBeNull()
    expect(hexToRgb('not-a-color')).toBeNull()
    expect(hexToRgb('')).toBeNull()
  })
})

describe('mergeTheme', () => {
  it('returns the default theme when nothing is provided', () => {
    expect(mergeTheme(undefined)).toEqual(DEFAULT_STORE_THEME)
    expect(mergeTheme(null)).toEqual(DEFAULT_STORE_THEME)
    expect(mergeTheme({})).toEqual(DEFAULT_STORE_THEME)
  })

  it('overrides top level fields and keeps the rest', () => {
    const merged = mergeTheme({ primary: '#000000', radius: 4 })
    expect(merged.primary).toBe('#000000')
    expect(merged.radius).toBe(4)
    expect(merged.accent).toBe(DEFAULT_STORE_THEME.accent)
    expect(merged.banner).toEqual(DEFAULT_STORE_THEME.banner)
  })

  it('deep merges the banner object', () => {
    const merged = mergeTheme({ banner: { overlayOpacity: 0.8 } })
    expect(merged.banner).toEqual({
      ...DEFAULT_STORE_THEME.banner,
      overlayOpacity: 0.8,
    })
  })

  it('ignores unknown keys and invalid values from untyped json', () => {
    const merged = mergeTheme({
      primary: 42,
      fontDisplay: 'Comic Sans',
      buttonStyle: 'weird',
      sectionOrder: ['menu', 'nope'],
      extra: true,
    })
    expect(merged.primary).toBe(DEFAULT_STORE_THEME.primary)
    expect(merged.fontDisplay).toBe(DEFAULT_STORE_THEME.fontDisplay)
    expect(merged.buttonStyle).toBe(DEFAULT_STORE_THEME.buttonStyle)
    expect(merged.sectionOrder).toEqual(['menu', 'hero', 'featured', 'info'])
    expect('extra' in merged).toBe(false)
  })

  it('normalizes hex colors to lowercase #rrggbb', () => {
    const merged = mergeTheme({
      primary: '#ABC',
      accent: 'f59e0b',
      background: ' #FBF8F3 ',
      surface: 'FFF',
    })
    expect(merged.primary).toBe('#aabbcc')
    expect(merged.accent).toBe('#f59e0b')
    expect(merged.background).toBe('#fbf8f3')
    expect(merged.surface).toBe('#ffffff')
  })

  it('completes an incomplete section order in default order', () => {
    expect(mergeTheme({ sectionOrder: ['info'] }).sectionOrder).toEqual([
      'info',
      'hero',
      'featured',
      'menu',
    ])
    expect(mergeTheme({ sectionOrder: [] }).sectionOrder).toEqual([
      ...DEFAULT_STORE_THEME.sectionOrder,
    ])
  })

  it('drops duplicated and unknown sections keeping the first occurrence', () => {
    expect(
      mergeTheme({ sectionOrder: ['menu', 'menu', 'hero', 42, 'menu', 'info'] })
        .sectionOrder,
    ).toEqual(['menu', 'hero', 'info', 'featured'])
  })

  it('always contains every core section exactly once', () => {
    const merged = mergeTheme({ sectionOrder: ['featured', 'featured'] })
    expect([...merged.sectionOrder].sort()).toEqual(
      [...DEFAULT_STORE_THEME.sectionOrder].sort(),
    )
  })

  it('keeps opt-in sections that are not part of the default order', () => {
    expect(
      mergeTheme({ sectionOrder: ['story', 'menu'] }).sectionOrder,
    ).toEqual(['story', 'menu', 'hero', 'featured', 'info'])
  })

  it('produces output that passes storeThemeSchema for messy input', () => {
    const merged = mergeTheme({
      primary: '#ABC',
      accent: 'f59e0b',
      text: 'not-a-color',
      radius: 12,
      sectionOrder: ['menu', 'menu', 'nope'],
      banner: { overlayOpacity: 2, layout: 'weird' },
      logoUrl: null,
    })
    expect(storeThemeSchema.safeParse(merged).success).toBe(true)
  })

  it('does not mutate the default theme', () => {
    mergeTheme({ banner: { layout: 'split' } })
    expect(DEFAULT_STORE_THEME.banner.layout).toBe('full')
  })
})

describe('themeToCssVars', () => {
  it('maps colors to the store variables', () => {
    const vars = themeToCssVars(DEFAULT_STORE_THEME)
    expect(vars['--store-primary']).toBe('#C2410C')
    expect(vars['--store-accent']).toBe('#F59E0B')
    expect(vars['--store-background']).toBe('#FBF8F3')
    expect(vars['--store-surface']).toBe('#FFFFFF')
    expect(vars['--store-text']).toBe('#1C1917')
  })

  it('exposes rgb triplets for alpha usage', () => {
    const vars = themeToCssVars(DEFAULT_STORE_THEME)
    expect(vars['--store-primary-rgb']).toBe('194 65 12')
    expect(vars['--store-text-rgb']).toBe('28 25 23')
  })

  it('writes the radius in pixels', () => {
    const vars = themeToCssVars({ ...DEFAULT_STORE_THEME, radius: 8 })
    expect(vars['--store-radius']).toBe('8px')
  })

  it('maps the button style to a radius', () => {
    const pill = themeToCssVars({ ...DEFAULT_STORE_THEME, buttonStyle: 'pill' })
    const rounded = themeToCssVars({
      ...DEFAULT_STORE_THEME,
      buttonStyle: 'rounded',
    })
    const square = themeToCssVars({
      ...DEFAULT_STORE_THEME,
      buttonStyle: 'square',
    })
    expect(pill['--store-button-radius']).toBe('999px')
    expect(rounded['--store-button-radius']).toBe('12px')
    expect(square['--store-button-radius']).toBe('4px')
  })

  it('writes font families with fallback stacks', () => {
    const vars = themeToCssVars(DEFAULT_STORE_THEME)
    expect(vars['--store-font-display']).toMatch(/^"Fraunces", .*serif$/)
    expect(vars['--store-font-body']).toMatch(/^"Inter", .*sans-serif$/)
    const grotesk = themeToCssVars({
      ...DEFAULT_STORE_THEME,
      fontDisplay: 'Space Grotesk',
    })
    expect(grotesk['--store-font-display']).toMatch(
      /^"Space Grotesk", .*sans-serif$/,
    )
  })

  it('exposes the banner overlay opacity', () => {
    const vars = themeToCssVars(DEFAULT_STORE_THEME)
    expect(vars['--store-banner-overlay']).toBe('0.35')
  })
})

// ---------------------------------------------------------------------------
// v2 theme fields
// ---------------------------------------------------------------------------

describe('normalizeTheme', () => {
  it('is the canonical name of mergeTheme', () => {
    expect(normalizeTheme).toBe(mergeTheme)
  })

  it('deep merges a partial nested object keeping the keys it sets', () => {
    const merged = normalizeTheme({
      hero: { align: 'center', tagline: '  Hecho en casa  ' },
    })
    expect(merged.hero.align).toBe('center')
    expect(merged.hero.tagline).toBe('Hecho en casa')
    expect(merged.hero.showLogo).toBe(DEFAULT_STORE_THEME.hero.showLogo)
    expect(merged.hero.logoSize).toBe(DEFAULT_STORE_THEME.hero.logoSize)
    expect(merged.hero.videoUrl).toBe(DEFAULT_STORE_THEME.hero.videoUrl)
  })

  it('deep merges every nested group independently', () => {
    const merged = normalizeTheme({
      gradient: { enabled: true },
      badges: { style: 'outline' },
      featured: { layout: 'bento' },
      story: { enabled: true },
      social: { whatsapp: true },
      footer: { showMap: false },
    })
    expect(merged.gradient).toEqual({
      ...DEFAULT_STORE_THEME.gradient,
      enabled: true,
    })
    expect(merged.badges).toEqual({
      ...DEFAULT_STORE_THEME.badges,
      style: 'outline',
    })
    expect(merged.featured).toEqual({
      ...DEFAULT_STORE_THEME.featured,
      layout: 'bento',
    })
    expect(merged.story).toEqual({
      ...DEFAULT_STORE_THEME.story,
      enabled: true,
    })
    expect(merged.social).toEqual({
      ...DEFAULT_STORE_THEME.social,
      whatsapp: true,
    })
    expect(merged.footer).toEqual({
      ...DEFAULT_STORE_THEME.footer,
      showMap: false,
    })
  })

  it('drops unknown keys at every level', () => {
    const merged = normalizeTheme({
      hero: { align: 'center', nope: 1 },
      gradient: { angle: 10, sneaky: 'yes' },
      whatIsThis: true,
    })
    expect('nope' in merged.hero).toBe(false)
    expect('sneaky' in merged.gradient).toBe(false)
    expect('whatIsThis' in merged).toBe(false)
  })

  it('clamps numeric ranges instead of rejecting them', () => {
    expect(normalizeTheme({ patternOpacity: 5 }).patternOpacity).toBe(0.2)
    expect(normalizeTheme({ patternOpacity: -1 }).patternOpacity).toBe(0)
    expect(normalizeTheme({ radius: 999 }).radius).toBe(64)
    expect(normalizeTheme({ radius: -8 }).radius).toBe(0)
    expect(normalizeTheme({ badges: { newDays: -4 } }).badges.newDays).toBe(0)
    expect(normalizeTheme({ badges: { newDays: 900 } }).badges.newDays).toBe(
      365,
    )
    expect(normalizeTheme({ badges: { newDays: 7.6 } }).badges.newDays).toBe(8)
    expect(normalizeTheme({ gradient: { angle: 400 } }).gradient.angle).toBe(
      360,
    )
    expect(normalizeTheme({ gradient: { angle: -20 } }).gradient.angle).toBe(0)
  })

  it('never throws on garbage and always yields a valid theme', () => {
    const garbage: unknown[] = [
      null,
      undefined,
      [],
      42,
      'theme',
      true,
      { hero: 5 },
      { hero: [] },
      { gradient: 'blue' },
      { badges: null },
      { social: 0 },
      { footer: [] },
      { story: { text: 12 } },
      { featured: { productIds: 'abc' } },
      { featured: { productIds: [1, null, 'ok'] } },
      { sectionOrder: 'menu' },
      { customCss: 12 },
      { mode: {} },
      { patternOpacity: Number.NaN },
      { radius: Number.POSITIVE_INFINITY },
    ]
    for (const input of garbage) {
      expect(() => normalizeTheme(input)).not.toThrow()
      const result = storeThemeSchema.safeParse(normalizeTheme(input))
      expect(result.success).toBe(true)
    }
  })

  it('keeps only string product ids', () => {
    expect(
      normalizeTheme({ featured: { productIds: [1, 'a', null, 'b', 'a'] } })
        .featured.productIds,
    ).toEqual(['a', 'b'])
  })

  it('drops a video url that is not an https mp4', () => {
    expect(
      normalizeTheme({ hero: { videoUrl: 'http://cdn.test/clip.mp4' } }).hero
        .videoUrl,
    ).toBeNull()
    expect(
      normalizeTheme({ hero: { videoUrl: 'https://cdn.test/clip.mov' } }).hero
        .videoUrl,
    ).toBeNull()
    expect(
      normalizeTheme({ hero: { videoUrl: 'https://cdn.test/clip.mp4' } }).hero
        .videoUrl,
    ).toBe('https://cdn.test/clip.mp4')
  })

  it('sanitises custom css while normalizing', () => {
    const merged = normalizeTheme({ customCss: '@import "evil.css";' })
    expect(merged.customCss).toBeNull()
    expect(
      normalizeTheme({ customCss: '.a { color: red }' })?.customCss,
    ).toMatch(/\[data-store-theme\]/)
  })
})

describe('contrastRatio', () => {
  it('is re-exported from lib/color/contrast', () => {
    expect(contrastRatio('#ffffff', '#000000')).toBeCloseTo(21, 1)
    expect(contrastRatio('#ffffff', '#ffffff')).toBeCloseTo(1, 5)
  })
})

describe('ensureReadable', () => {
  it('leaves the default theme untouched and warning free', () => {
    const { theme, warnings } = ensureReadable(DEFAULT_STORE_THEME)
    expect(warnings).toEqual([])
    expect(theme).toEqual(DEFAULT_STORE_THEME)
  })

  it('switches onPrimary to near white on a dark primary', () => {
    const { theme } = ensureReadable(
      normalizeTheme({ primary: '#1c1917', onPrimary: '#1c1917' }),
    )
    expect(
      contrastRatio(theme.onPrimary, theme.primary),
    ).toBeGreaterThanOrEqual(4.5)
    expect(theme.onPrimary).toBe('#ffffff')
  })

  it('switches onPrimary to near black on a light primary', () => {
    const { theme } = ensureReadable(
      normalizeTheme({ primary: '#ffff00', onPrimary: '#ffffff' }),
    )
    expect(
      contrastRatio(theme.onPrimary, theme.primary),
    ).toBeGreaterThanOrEqual(4.5)
    expect(theme.onPrimary).toBe('#1c1917')
  })

  it('keeps an onPrimary that already passes AA', () => {
    const { theme } = ensureReadable(
      normalizeTheme({ primary: '#c2410c', onPrimary: '#ffffff' }),
    )
    expect(theme.onPrimary).toBe('#ffffff')
  })

  it('only warns for text on background and text on surface', () => {
    const input = normalizeTheme({
      text: '#eeeeee',
      background: '#ffffff',
      surface: '#ffffff',
    })
    const { theme, warnings } = ensureReadable(input)
    expect(theme.text).toBe('#eeeeee')
    expect(theme.background).toBe('#ffffff')
    expect(theme.surface).toBe('#ffffff')
    expect(warnings.map((warning) => warning.field)).toEqual([
      'text',
      'surface',
    ])
    for (const warning of warnings) {
      expect(warning.required).toBe(4.5)
      expect(warning.ratio).toBeLessThan(4.5)
      expect(warning.message).toContain('4.5')
    }
  })

  it('warns for an unreadable secondary without changing it', () => {
    const input = normalizeTheme({
      secondary: '#fbfbfb',
      surface: '#ffffff',
    })
    const { theme, warnings } = ensureReadable(input)
    expect(theme.secondary).toBe('#fbfbfb')
    expect(warnings.map((warning) => warning.field)).toContain('secondary')
  })

  it('does not mutate the theme it receives', () => {
    const input = normalizeTheme({ primary: '#ffff00', onPrimary: '#ffffff' })
    ensureReadable(input)
    expect(input.onPrimary).toBe('#ffffff')
  })
})

describe('themeToCssVars v2', () => {
  const V1_VARS = [
    '--store-primary',
    '--store-primary-rgb',
    '--store-accent',
    '--store-accent-rgb',
    '--store-background',
    '--store-background-rgb',
    '--store-surface',
    '--store-surface-rgb',
    '--store-text',
    '--store-text-rgb',
    '--store-radius',
    '--store-button-radius',
    '--store-font-display',
    '--store-font-body',
    '--store-banner-overlay',
  ]

  const V2_VARS = [
    '--store-on-primary',
    '--store-secondary',
    '--store-gradient',
    '--store-pattern-image',
    '--store-pattern-opacity',
    '--store-heading-weight',
    '--store-heading-case',
    '--store-letter-spacing',
    '--store-density-padding',
    '--store-density-gap',
    '--store-density-section',
    '--store-card-shadow',
    '--store-card-border',
    '--store-image-ratio',
    '--store-image-radius',
    '--store-motion-duration',
  ]

  it('keeps every variable it already emitted', () => {
    const vars = themeToCssVars(DEFAULT_STORE_THEME)
    for (const name of V1_VARS) expect(vars).toHaveProperty(name)
  })

  it('emits every new visual variable', () => {
    const vars = themeToCssVars(DEFAULT_STORE_THEME)
    for (const name of V2_VARS) expect(vars).toHaveProperty(name)
  })

  it('writes none when the gradient is disabled', () => {
    const vars = themeToCssVars(DEFAULT_STORE_THEME)
    expect(vars['--store-gradient']).toBe('none')
  })

  it('builds a ready to use linear-gradient when enabled', () => {
    const vars = themeToCssVars(
      normalizeTheme({
        gradient: { enabled: true, from: '#000000', to: '#ffffff', angle: 90 },
      }),
    )
    expect(vars['--store-gradient']).toBe(
      'linear-gradient(90deg, #000000, #ffffff)',
    )
  })

  it('maps typography choices to css values', () => {
    const vars = themeToCssVars(
      normalizeTheme({
        headingWeight: 500,
        headingCase: 'uppercase',
        letterSpacing: 'wide',
      }),
    )
    expect(vars['--store-heading-weight']).toBe('500')
    expect(vars['--store-heading-case']).toBe('uppercase')
    expect(vars['--store-letter-spacing']).toMatch(/em$/)
    expect(themeToCssVars(DEFAULT_STORE_THEME)['--store-heading-case']).toBe(
      'none',
    )
  })

  it('maps the image ratio to an aspect-ratio value', () => {
    expect(
      themeToCssVars(normalizeTheme({ imageRatio: '1:1' }))[
        '--store-image-ratio'
      ],
    ).toBe('1 / 1')
    expect(
      themeToCssVars(normalizeTheme({ imageRatio: '16:9' }))[
        '--store-image-ratio'
      ],
    ).toBe('16 / 9')
  })

  it('maps the image shape to a border radius', () => {
    expect(
      themeToCssVars(normalizeTheme({ imageShape: 'circle' }))[
        '--store-image-radius'
      ],
    ).toBe('999px')
    expect(
      themeToCssVars(normalizeTheme({ imageShape: 'arch' }))[
        '--store-image-radius'
      ],
    ).toMatch(/^999px 999px/)
  })

  it('maps motion to a duration', () => {
    expect(
      themeToCssVars(normalizeTheme({ motion: 'none' }))[
        '--store-motion-duration'
      ],
    ).toBe('0ms')
    expect(
      themeToCssVars(DEFAULT_STORE_THEME)['--store-motion-duration'],
    ).toMatch(/ms$/)
  })

  it('maps the card style to a shadow and a border', () => {
    const flat = themeToCssVars(normalizeTheme({ cardStyle: 'flat' }))
    const outlined = themeToCssVars(normalizeTheme({ cardStyle: 'outlined' }))
    expect(flat['--store-card-shadow']).toBe('none')
    expect(outlined['--store-card-border']).toContain('1px solid')
  })

  it('scales density padding and gap', () => {
    const compact = themeToCssVars(normalizeTheme({ density: 'compact' }))
    const spacious = themeToCssVars(normalizeTheme({ density: 'spacious' }))
    expect(compact['--store-density-padding']).not.toBe(
      spacious['--store-density-padding'],
    )
    expect(compact['--store-density-gap']).toMatch(/rem$/)
  })
})

describe('store theme migration', () => {
  const sql = readFileSync(
    join(
      process.cwd(),
      'supabase/migrations/20260912000500_store_theme_v2.sql',
    ),
    'utf8',
  )

  /** Both JSON literals in the migration: the column default and the merge base. */
  const literals = [...sql.matchAll(/'(\{[\s\S]*?\})'::jsonb/g)]
    .map((match) => match[1])
    .filter((literal) => literal.includes('"mode"'))

  it('carries the default theme twice as valid json', () => {
    expect(literals).toHaveLength(2)
    for (const literal of literals) {
      expect(() => JSON.parse(literal)).not.toThrow()
    }
  })

  it('keeps the stored default in sync with DEFAULT_STORE_THEME', () => {
    for (const literal of literals) {
      expect(JSON.parse(literal)).toEqual(DEFAULT_STORE_THEME)
    }
  })

  it('merges every nested group explicitly', () => {
    for (const group of [
      'banner',
      'gradient',
      'badges',
      'hero',
      'featured',
      'story',
      'social',
      'footer',
    ]) {
      expect(sql).toContain(`'${group}',`)
    }
  })
})
