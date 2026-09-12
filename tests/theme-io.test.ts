import { describe, expect, it } from 'vitest'
import { THEME_PRESETS } from '@/lib/theme/presets'
import {
  THEME_EXPORT_KIND,
  exportTheme,
  importTheme,
  themeFileName,
} from '@/lib/theme/io'
import { normalizeTheme } from '@/lib/theme'
import { DEFAULT_STORE_THEME } from '@/types/app'

describe('exportTheme', () => {
  it('writes a readable JSON envelope', () => {
    const parsed = JSON.parse(exportTheme(DEFAULT_STORE_THEME))
    expect(parsed.kind).toBe(THEME_EXPORT_KIND)
    expect(parsed.version).toBe(1)
    expect(parsed.theme.primary).toBe(DEFAULT_STORE_THEME.primary)
  })

  it('round-trips through importTheme', () => {
    for (const preset of THEME_PRESETS) {
      const result = importTheme(exportTheme(preset.theme))
      expect(result.ok).toBe(true)
      if (result.ok) expect(result.theme).toEqual(preset.theme)
    }
  })
})

describe('importTheme', () => {
  it('accepts a bare theme object without the envelope', () => {
    const result = importTheme(JSON.stringify(DEFAULT_STORE_THEME))
    expect(result.ok).toBe(true)
    // normalizeTheme canonicalises hex to lowercase, so compare through it.
    if (result.ok) {
      expect(result.theme).toEqual(normalizeTheme(DEFAULT_STORE_THEME))
    }
  })

  it('rejects text that is not JSON', () => {
    const result = importTheme('{ not json')
    expect(result.ok).toBe(false)
    if (!result.ok) expect(result.error).toMatch(/archivo|JSON/i)
  })

  it('rejects a JSON value that is not an object', () => {
    for (const text of ['[]', '"hello"', '42', 'null']) {
      expect(importTheme(text).ok).toBe(false)
    }
  })

  it('rejects an empty string', () => {
    expect(importTheme('   ').ok).toBe(false)
  })

  it('fills in whatever the file left out instead of trusting it', () => {
    const result = importTheme(JSON.stringify({ primary: '#0aa3ff' }))
    expect(result.ok).toBe(true)
    if (result.ok) {
      expect(result.theme.primary).toBe('#0aa3ff')
      expect(result.theme.fontBody).toBe(DEFAULT_STORE_THEME.fontBody)
      expect(result.theme.sectionOrder).toEqual(
        DEFAULT_STORE_THEME.sectionOrder,
      )
    }
  })

  it('drops unknown keys from a pasted file', () => {
    const result = importTheme(
      JSON.stringify({ ...DEFAULT_STORE_THEME, evil: 'payload' }),
    )
    expect(result.ok).toBe(true)
    if (result.ok) expect('evil' in result.theme).toBe(false)
  })

  it('sanitises custom CSS carried by the file', () => {
    const result = importTheme(
      JSON.stringify({
        ...DEFAULT_STORE_THEME,
        customCss:
          'body { display: none } @import url(https://evil.test/x.css);',
      }),
    )
    expect(result.ok).toBe(true)
    if (result.ok) {
      expect(result.theme.customCss ?? '').not.toMatch(/@import/i)
      expect(result.theme.customCss ?? '').not.toMatch(/(^|\s)body\s*\{/i)
    }
  })

  it('clamps a hostile numeric value instead of failing', () => {
    const result = importTheme(
      JSON.stringify({ ...DEFAULT_STORE_THEME, radius: 9999 }),
    )
    expect(result.ok).toBe(true)
    if (result.ok) expect(result.theme.radius).toBe(64)
  })

  it('recovers from a colour that is not a colour', () => {
    const result = importTheme(
      JSON.stringify({
        ...DEFAULT_STORE_THEME,
        primary: 'javascript:alert(1)',
      }),
    )
    expect(result.ok).toBe(true)
    if (result.ok)
      expect(result.theme.primary).toBe(DEFAULT_STORE_THEME.primary)
  })

  it('refuses a file larger than the allowed size', () => {
    const result = importTheme(
      JSON.stringify({
        theme: DEFAULT_STORE_THEME,
        padding: 'x'.repeat(200_000),
      }),
    )
    expect(result.ok).toBe(false)
  })
})

describe('themeFileName', () => {
  it('derives a slug-safe file name from the store name', () => {
    expect(themeFileName('Arepa & Co')).toBe('tema-arepa-co.json')
  })

  it('falls back when the name has no usable characters', () => {
    expect(themeFileName('  ***  ')).toBe('tema-tienda.json')
  })
})
