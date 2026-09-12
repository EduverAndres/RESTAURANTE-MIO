import { describe, expect, it } from 'vitest'
import { moveSection, storeThemeSchema } from '@/lib/validations/theme'
import { DEFAULT_STORE_THEME } from '@/types/app'

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
        sectionOrder: ['menu', 'hero', 'info', 'featured'],
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
        sectionOrder: ['hero', 'hero', 'menu', 'info'],
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
