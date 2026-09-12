import { describe, expect, it } from 'vitest'
import { hexToRgb, mergeTheme, themeToCssVars } from '@/lib/theme'
import { storeThemeSchema } from '@/lib/validations/theme'
import { DEFAULT_STORE_THEME, THEME_SECTIONS } from '@/types/app'

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

  it('always contains every section exactly once', () => {
    const merged = mergeTheme({ sectionOrder: ['featured', 'featured'] })
    expect([...merged.sectionOrder].sort()).toEqual([...THEME_SECTIONS].sort())
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
