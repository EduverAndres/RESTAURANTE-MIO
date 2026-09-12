import { describe, expect, it } from 'vitest'
import {
  ACCESSIBILITY_STORAGE_KEY,
  DEFAULT_ACCESSIBILITY_PREFERENCES,
  accessibilityAnnouncement,
  accessibilityDataAttributes,
  accessibilityPreferencesScript,
  readAccessibilityPreferences,
  type AccessibilityPreferences,
} from '@/lib/a11y/preferences'

function prefs(
  overrides: Partial<AccessibilityPreferences> = {},
): AccessibilityPreferences {
  return { ...DEFAULT_ACCESSIBILITY_PREFERENCES, ...overrides }
}

describe('accessibilityDataAttributes', () => {
  it('emits nothing for the default preferences', () => {
    expect(accessibilityDataAttributes(prefs())).toEqual({
      'data-text-size': null,
      'data-contrast': null,
      'data-motion': null,
    })
  })

  it('stamps the text size when it is not the default', () => {
    expect(accessibilityDataAttributes(prefs({ textSize: 'large' }))).toEqual({
      'data-text-size': 'large',
      'data-contrast': null,
      'data-motion': null,
    })
    expect(
      accessibilityDataAttributes(prefs({ textSize: 'xlarge' }))[
        'data-text-size'
      ],
    ).toBe('xlarge')
  })

  it('stamps high contrast and reduced motion only when enabled', () => {
    const on = accessibilityDataAttributes(
      prefs({ highContrast: true, reduceMotion: true }),
    )
    expect(on['data-contrast']).toBe('high')
    expect(on['data-motion']).toBe('reduce')
  })
})

describe('readAccessibilityPreferences', () => {
  it('falls back to the defaults for missing or unreadable storage', () => {
    expect(readAccessibilityPreferences(null)).toEqual(
      DEFAULT_ACCESSIBILITY_PREFERENCES,
    )
    expect(readAccessibilityPreferences('not json')).toEqual(
      DEFAULT_ACCESSIBILITY_PREFERENCES,
    )
    expect(readAccessibilityPreferences('null')).toEqual(
      DEFAULT_ACCESSIBILITY_PREFERENCES,
    )
    expect(readAccessibilityPreferences('{"state":42}')).toEqual(
      DEFAULT_ACCESSIBILITY_PREFERENCES,
    )
  })

  it('reads the zustand persist envelope', () => {
    const raw = JSON.stringify({
      state: { textSize: 'xlarge', highContrast: true, reduceMotion: false },
      version: 0,
    })
    expect(readAccessibilityPreferences(raw)).toEqual({
      textSize: 'xlarge',
      highContrast: true,
      reduceMotion: false,
    })
  })

  it('ignores unrelated keys already stored under the same name', () => {
    const raw = JSON.stringify({
      state: { paymentMethod: 'cash', tipPercent: 10 },
      version: 0,
    })
    expect(readAccessibilityPreferences(raw)).toEqual(
      DEFAULT_ACCESSIBILITY_PREFERENCES,
    )
  })

  it('rejects a text size outside the allowed set', () => {
    const raw = JSON.stringify({ state: { textSize: 'gigantic' } })
    expect(readAccessibilityPreferences(raw).textSize).toBe('normal')
  })

  it('rejects non-boolean toggles', () => {
    const raw = JSON.stringify({
      state: { highContrast: 'yes', reduceMotion: 1 },
    })
    const result = readAccessibilityPreferences(raw)
    expect(result.highContrast).toBe(false)
    expect(result.reduceMotion).toBe(false)
  })
})

describe('accessibilityPreferencesScript', () => {
  const source = accessibilityPreferencesScript()

  it('names the storage key it reads', () => {
    expect(source).toContain(ACCESSIBILITY_STORAGE_KEY)
  })

  it('is wrapped in a try/catch so blocked storage cannot break the page', () => {
    expect(source).toContain('try')
    expect(source).toContain('catch')
  })

  it('cannot break out of the script tag it is inlined into', () => {
    expect(source).not.toContain('</script')
  })

  it('applies the three data attributes', () => {
    expect(source).toContain('data-text-size')
    expect(source).toContain('data-contrast')
    expect(source).toContain('data-motion')
  })
})

describe('accessibilityAnnouncement', () => {
  it('describes the default state in Spanish', () => {
    expect(accessibilityAnnouncement(prefs())).toBe(
      'Texto normal. Contraste normal. Animaciones activadas.',
    )
  })

  it('describes every option turned on', () => {
    expect(
      accessibilityAnnouncement(
        prefs({ textSize: 'xlarge', highContrast: true, reduceMotion: true }),
      ),
    ).toBe('Texto extra grande. Contraste alto. Animaciones reducidas.')
  })
})
