import { describe, expect, it } from 'vitest'
import {
  PREVIEW_COOKIE,
  PREVIEW_MESSAGE_TYPE,
  PREVIEW_THEME_MAX_COOKIE_BYTES,
  decodePreviewTheme,
  encodePreviewTheme,
  isPreviewMessage,
  previewCookieName,
  structureSignature,
} from '@/lib/theme/preview-message'
import { THEME_PRESETS } from '@/lib/theme/presets'
import { normalizeTheme } from '@/lib/theme'
import { DEFAULT_STORE_THEME } from '@/types/app'

describe('encodePreviewTheme / decodePreviewTheme', () => {
  it('round-trips a theme through a cookie-safe string', () => {
    const encoded = encodePreviewTheme(DEFAULT_STORE_THEME)
    expect(encoded).not.toBeNull()
    expect(encoded).toMatch(/^[A-Za-z0-9_-]+$/)
    // normalizeTheme canonicalises hex to lowercase, so compare through it.
    expect(normalizeTheme(decodePreviewTheme(encoded!))).toEqual(
      normalizeTheme(DEFAULT_STORE_THEME),
    )
  })

  it('round-trips every preset', () => {
    for (const preset of THEME_PRESETS) {
      const encoded = encodePreviewTheme(preset.theme)
      expect(normalizeTheme(decodePreviewTheme(encoded!))).toEqual(preset.theme)
    }
  })

  it('survives accents and emoji in the copy', () => {
    const theme = {
      ...DEFAULT_STORE_THEME,
      hero: { ...DEFAULT_STORE_THEME.hero, tagline: 'Café con pandebono 🥐' },
    }
    const decoded = normalizeTheme(
      decodePreviewTheme(encodePreviewTheme(theme)!),
    )
    expect(decoded.hero.tagline).toBe('Café con pandebono 🥐')
  })

  it('leaves custom CSS out of the cookie', () => {
    const encoded = encodePreviewTheme({
      ...DEFAULT_STORE_THEME,
      customCss: '[data-store-theme] .x { color: red }',
    })
    const decoded = decodePreviewTheme(encoded!) as Record<string, unknown>
    expect(decoded.customCss ?? null).toBeNull()
  })

  it('stays inside the cookie budget for every preset', () => {
    for (const preset of THEME_PRESETS) {
      const encoded = encodePreviewTheme(preset.theme)!
      expect(`${PREVIEW_COOKIE}=${encoded}`.length).toBeLessThan(
        PREVIEW_THEME_MAX_COOKIE_BYTES,
      )
    }
  })

  it('returns null rather than an oversized cookie', () => {
    const huge = {
      ...DEFAULT_STORE_THEME,
      story: { ...DEFAULT_STORE_THEME.story, text: 'x'.repeat(50_000) },
    }
    expect(encodePreviewTheme(huge)).toBeNull()
  })

  it('decodes garbage to null instead of throwing', () => {
    expect(decodePreviewTheme(undefined)).toBeNull()
    expect(decodePreviewTheme('')).toBeNull()
    expect(decodePreviewTheme('!!!not base64!!!')).toBeNull()
    expect(decodePreviewTheme('bm90IGpzb24')).toBeNull()
  })
})

describe('previewCookieName', () => {
  it('gives every store its own cookie', () => {
    const a = previewCookieName('11111111-2222-3333-4444-555555555555')
    const b = previewCookieName('99999999-2222-3333-4444-555555555555')
    expect(a).not.toBe(b)
    expect(a.startsWith(PREVIEW_COOKIE)).toBe(true)
  })

  it('only ever emits a valid cookie name', () => {
    for (const id of ['', '../../etc', 'a b;c=d', 'ok-id-1']) {
      expect(previewCookieName(id)).toMatch(/^[A-Za-z0-9_]+$/)
    }
  })

  it('is stable for the same store', () => {
    expect(previewCookieName('store-1')).toBe(previewCookieName('store-1'))
  })
})

describe('structureSignature', () => {
  it('is stable for the same theme', () => {
    expect(structureSignature(DEFAULT_STORE_THEME)).toBe(
      structureSignature(DEFAULT_STORE_THEME),
    )
  })

  it('ignores changes that CSS variables alone can apply', () => {
    const before = structureSignature(DEFAULT_STORE_THEME)
    for (const patch of [
      { primary: '#0aa3ff' },
      { radius: 4 },
      { density: 'spacious' as const },
      { pattern: 'dots' as const },
      { fontDisplay: 'Geist' as const },
      { customCss: '[data-store-theme] { color: red }' },
      { motion: 'none' as const },
    ]) {
      expect(structureSignature({ ...DEFAULT_STORE_THEME, ...patch })).toBe(
        before,
      )
    }
  })

  it('changes when the rendered structure changes', () => {
    const before = structureSignature(DEFAULT_STORE_THEME)
    const patches = [
      { menuLayout: 'list' as const },
      { categoryNav: 'tabs' as const },
      { showPrices: 'on-hover' as const },
      { sectionOrder: ['menu', 'hero', 'featured', 'info'] as never },
      { banner: { ...DEFAULT_STORE_THEME.banner, layout: 'split' as const } },
      {
        hero: { ...DEFAULT_STORE_THEME.hero, tagline: 'Nuevo' },
      },
      {
        featured: { ...DEFAULT_STORE_THEME.featured, productIds: ['a'] },
      },
      {
        story: { ...DEFAULT_STORE_THEME.story, enabled: true, text: 'Hola' },
      },
      {
        social: { ...DEFAULT_STORE_THEME.social, instagram: '@x' },
      },
      { footer: { ...DEFAULT_STORE_THEME.footer, showMap: false } },
      { mode: 'dark' as const },
    ]
    for (const patch of patches) {
      expect(
        structureSignature({ ...DEFAULT_STORE_THEME, ...patch }),
        JSON.stringify(patch),
      ).not.toBe(before)
    }
  })
})

describe('isPreviewMessage', () => {
  it('accepts a well formed message', () => {
    expect(
      isPreviewMessage({
        type: PREVIEW_MESSAGE_TYPE,
        theme: DEFAULT_STORE_THEME,
        scheme: 'light',
      }),
    ).toBe(true)
  })

  it('rejects anything else', () => {
    expect(isPreviewMessage(null)).toBe(false)
    expect(isPreviewMessage('hello')).toBe(false)
    expect(isPreviewMessage({ type: 'other', theme: {} })).toBe(false)
    expect(isPreviewMessage({ type: PREVIEW_MESSAGE_TYPE })).toBe(false)
  })
})
