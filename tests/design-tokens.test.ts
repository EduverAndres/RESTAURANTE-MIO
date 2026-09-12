// @vitest-environment node
// This suite only reads a stylesheet as text; under jsdom `import.meta.url`
// is not a file:// URL, so it cannot be resolved back to a path.
import { readFileSync } from 'node:fs'
import { fileURLToPath } from 'node:url'
import { describe, expect, it } from 'vitest'
import { contrastRatio } from '@/lib/color/contrast'

const css = readFileSync(
  fileURLToPath(new URL('../app/globals.css', import.meta.url)),
  'utf8',
)

/** Hex-valued custom properties declared directly inside a top-level block. */
function hexTokens(selector: string): Record<string, string> {
  // Built from a string, so every regex metacharacter needs a doubled
  // backslash: `'\s'` in a JS string is just `'s'`.
  const escaped = selector.replace(/[.]/g, '\\.')
  const pattern = new RegExp(`^${escaped} \\{\\n([\\s\\S]*?)\\n\\}`, 'm')
  const block = pattern.exec(css)?.[1]
  if (!block) throw new Error(`Block "${selector}" not found in globals.css`)
  const tokens: Record<string, string> = {}
  for (const match of block.matchAll(/--([\w-]+):\s*(#[0-9a-f]{3,6})\s*;/gi)) {
    tokens[match[1]] = match[2].toLowerCase()
  }
  return tokens
}

function rootTokenNames(): string[] {
  const block = /^:root \{\n([\s\S]*?)\n\}/m.exec(css)?.[1] ?? ''
  return Array.from(block.matchAll(/^\s*--([\w-]+):/gm), (m) => m[1])
}

const AA = 4.5

describe('light palette (:root)', () => {
  const t = hexTokens(':root')

  it('meets AA for text on background and surfaces', () => {
    expect(contrastRatio(t.foreground, t.background)).toBeGreaterThanOrEqual(AA)
    expect(
      contrastRatio(t['muted-foreground'], t.background),
    ).toBeGreaterThanOrEqual(AA)
    expect(contrastRatio(t['muted-foreground'], t.card)).toBeGreaterThanOrEqual(
      AA,
    )
  })

  it('meets AA for primary button text', () => {
    expect(
      contrastRatio(t['primary-foreground'], t.primary),
    ).toBeGreaterThanOrEqual(AA)
  })
})

describe('dark palette (.dark)', () => {
  const t = hexTokens('.dark')

  it('uses the warm dark ramp', () => {
    expect(t.background).toBe('#0e0d0b')
    expect(t.surface).toBe('#161412')
    expect(t.card).toBe('#1d1a17')
    expect(t.popover).toBe('#1d1a17')
    expect(t['surface-elevated']).toBe('#242019')
    expect(t.foreground).toBe('#f3efe8')
    expect(t['muted-foreground']).toBe('#a89f93')
  })

  it('meets AA for text on background and surfaces', () => {
    expect(contrastRatio(t.foreground, t.background)).toBeGreaterThanOrEqual(AA)
    expect(contrastRatio(t.foreground, t.card)).toBeGreaterThanOrEqual(AA)
    expect(
      contrastRatio(t['muted-foreground'], t.background),
    ).toBeGreaterThanOrEqual(AA)
    expect(contrastRatio(t['muted-foreground'], t.card)).toBeGreaterThanOrEqual(
      AA,
    )
    expect(
      contrastRatio(t['muted-foreground'], t['surface-elevated']),
    ).toBeGreaterThanOrEqual(AA)
  })

  it('meets AA for primary button text', () => {
    expect(
      contrastRatio(t['primary-foreground'], t.primary),
    ).toBeGreaterThanOrEqual(AA)
  })
})

describe('design tokens', () => {
  const names = rootTokenNames()

  it.each([
    'text-display',
    'text-h1',
    'text-h2',
    'text-h3',
    'text-lead',
    'text-body',
    'text-small',
    'tracking-display',
    'tracking-tight',
    'space-section',
    'space-card',
    'space-inline',
    'space-gutter',
    'elevation-tint',
    'duration-fast',
    'duration-base',
    'duration-slow',
    'ease-out-soft',
    'store-on-primary',
  ])('declares --%s in :root', (name) => {
    expect(names).toContain(name)
  })

  it('declares a fluid display size from 2rem to 4.5rem', () => {
    expect(css).toMatch(/--text-display:\s*clamp\(2rem,\s*[^,]+vw,\s*4\.5rem\)/)
  })

  it('keeps body text at a minimum of 1rem', () => {
    expect(css).toMatch(/--text-body:\s*clamp\(1rem,/)
  })

  it('exposes tinted elevation, glass, store utilities and motion policy', () => {
    expect(css).toMatch(/--shadow-1:/)
    expect(css).toMatch(/--shadow-2:/)
    expect(css).toMatch(/--shadow-3:/)
    expect(css).toMatch(/--shadow-soft:\s*var\(--shadow-1\)/)
    expect(css).toMatch(/--shadow-lift:\s*var\(--shadow-2\)/)
    expect(css).toMatch(/--store-secondary:/)
    expect(css).toMatch(/@utility surface-glass/)
    for (const name of [
      'store-btn',
      'store-btn-outline',
      'store-chip',
      'store-card',
      'store-text',
      'store-muted',
      'store-link',
    ]) {
      expect(css).toMatch(new RegExp(`@utility ${name} `))
    }
    expect(css).toMatch(/prefers-reduced-motion: reduce/)
  })
})
