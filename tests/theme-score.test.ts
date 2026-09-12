import { describe, expect, it } from 'vitest'
import { contrastRatio } from '@/lib/color/contrast'
import {
  ACCESSIBILITY_CHECK_IDS,
  applyAccessibilityFix,
  applyAllAccessibilityFixes,
  auditTheme,
} from '@/lib/theme/score'
import { DEFAULT_STORE_THEME, type StoreTheme } from '@/types/app'

function theme(patch: Partial<StoreTheme> = {}): StoreTheme {
  return { ...DEFAULT_STORE_THEME, ...patch }
}

describe('auditTheme', () => {
  it('scores the shipped default theme at 100', () => {
    const report = auditTheme(DEFAULT_STORE_THEME)
    expect(report.score).toBe(100)
    expect(report.checks.every((check) => check.status === 'pass')).toBe(true)
  })

  it('returns every check, always in the same order', () => {
    const report = auditTheme(theme({ text: '#eeeeee' }))
    expect(report.checks.map((check) => check.id)).toEqual([
      ...ACCESSIBILITY_CHECK_IDS,
    ])
  })

  it('keeps the score between 0 and 100', () => {
    const worst = auditTheme(
      theme({
        text: '#fdfdfd',
        background: '#ffffff',
        surface: '#ffffff',
        primary: '#fefefe',
        density: 'compact',
        headingCase: 'uppercase',
        letterSpacing: 'tight',
      }),
    )
    expect(worst.score).toBeGreaterThanOrEqual(0)
    expect(worst.score).toBeLessThanOrEqual(100)
    expect(worst.score).toBeLessThan(40)
  })

  it('fails the text/background check when the ink is too pale', () => {
    const report = auditTheme(theme({ text: '#f2f2f2', background: '#ffffff' }))
    const check = report.checks.find((item) => item.id === 'text-background')
    expect(check?.status).toBe('fail')
    expect(check?.ratio).toBeCloseTo(contrastRatio('#f2f2f2', '#ffffff'), 2)
  })

  it('fails the text/surface check independently of the background', () => {
    const report = auditTheme(
      theme({ text: '#1c1917', background: '#ffffff', surface: '#211f1d' }),
    )
    expect(
      report.checks.find((item) => item.id === 'text-surface')?.status,
    ).toBe('fail')
    expect(
      report.checks.find((item) => item.id === 'text-background')?.status,
    ).toBe('pass')
  })

  it('fails the text-on-primary check when no ink reads on the brand colour', () => {
    const report = auditTheme(theme({ primary: '#7f7f7f' }))
    expect(report.checks.find((item) => item.id === 'on-primary')?.status).toBe(
      'fail',
    )
  })

  it('warns about touch targets on a compact density', () => {
    const report = auditTheme(theme({ density: 'compact' }))
    const check = report.checks.find((item) => item.id === 'touch-target')
    expect(check?.status).toBe('warn')
    expect(
      auditTheme(theme({ density: 'comfortable' })).checks.find(
        (item) => item.id === 'touch-target',
      )?.status,
    ).toBe('pass')
  })

  it('warns when uppercase headings are also tightly tracked', () => {
    const report = auditTheme(
      theme({ headingCase: 'uppercase', letterSpacing: 'tight' }),
    )
    expect(
      report.checks.find((item) => item.id === 'heading-legibility')?.status,
    ).not.toBe('pass')
  })

  it('writes every message in Spanish and offers a fix only when it can', () => {
    for (const check of auditTheme(theme({ text: '#eeeeee' })).checks) {
      expect(check.label.length).toBeGreaterThan(3)
      expect(check.detail.length).toBeGreaterThan(3)
      if (check.status === 'pass') expect(check.fixable).toBe(false)
    }
  })

  it('is deterministic', () => {
    expect(auditTheme(theme({ primary: '#0aa3ff' }))).toEqual(
      auditTheme(theme({ primary: '#0aa3ff' })),
    )
  })

  it('never throws on a theme carrying a broken colour', () => {
    expect(() => auditTheme(theme({ text: 'rgb(0,0,0)' }))).not.toThrow()
  })
})

describe('applyAccessibilityFix', () => {
  it('darkens the text until it clears AA on the background', () => {
    const fixed = applyAccessibilityFix(
      theme({ text: '#e8e8e8', background: '#ffffff' }),
      'text-background',
    )
    expect(contrastRatio(fixed.text, fixed.background)).toBeGreaterThanOrEqual(
      4.5,
    )
  })

  it('lightens the text instead when the background is dark', () => {
    const fixed = applyAccessibilityFix(
      theme({ text: '#2a2a2a', background: '#101010' }),
      'text-background',
    )
    expect(contrastRatio(fixed.text, fixed.background)).toBeGreaterThanOrEqual(
      4.5,
    )
  })

  it('fixes the text on surface pair', () => {
    const fixed = applyAccessibilityFix(
      theme({ text: '#1c1917', surface: '#211f1d' }),
      'text-surface',
    )
    expect(contrastRatio(fixed.text, fixed.surface)).toBeGreaterThanOrEqual(4.5)
  })

  it('moves the brand colour until an ink reads on it', () => {
    const fixed = applyAccessibilityFix(
      theme({ primary: '#7f7f7f' }),
      'on-primary',
    )
    const best = Math.max(
      contrastRatio('#ffffff', fixed.primary),
      contrastRatio('#1c1917', fixed.primary),
    )
    expect(best).toBeGreaterThanOrEqual(4.5)
  })

  it('relaxes the density for the touch target check', () => {
    expect(
      applyAccessibilityFix(theme({ density: 'compact' }), 'touch-target')
        .density,
    ).toBe('comfortable')
  })

  it('opens up the letter spacing for the heading check', () => {
    const fixed = applyAccessibilityFix(
      theme({ headingCase: 'uppercase', letterSpacing: 'tight' }),
      'heading-legibility',
    )
    expect(fixed.letterSpacing).not.toBe('tight')
  })

  it('leaves a passing theme untouched', () => {
    for (const id of ACCESSIBILITY_CHECK_IDS) {
      expect(applyAccessibilityFix(DEFAULT_STORE_THEME, id)).toEqual(
        DEFAULT_STORE_THEME,
      )
    }
  })

  it('never mutates the theme it is given', () => {
    const input = theme({ text: '#e8e8e8' })
    const snapshot = JSON.stringify(input)
    applyAccessibilityFix(input, 'text-background')
    expect(JSON.stringify(input)).toBe(snapshot)
  })
})

describe('applyAllAccessibilityFixes', () => {
  it('raises a badly broken theme to a perfect score', () => {
    const broken = theme({
      text: '#f2f2f2',
      background: '#ffffff',
      surface: '#fcfcfc',
      primary: '#7f7f7f',
      density: 'compact',
      headingCase: 'uppercase',
      letterSpacing: 'tight',
    })
    const fixed = applyAllAccessibilityFixes(broken)
    expect(auditTheme(fixed).score).toBe(100)
  })

  it('is idempotent', () => {
    const once = applyAllAccessibilityFixes(theme({ text: '#eeeeee' }))
    expect(applyAllAccessibilityFixes(once)).toEqual(once)
  })
})
