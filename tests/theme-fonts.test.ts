// @vitest-environment node
import { readFileSync } from 'node:fs'
import { fileURLToPath } from 'node:url'
import { describe, expect, it } from 'vitest'
import { fontFamilyStack } from '@/lib/theme'
import { THEME_FONTS } from '@/types/app'

const layout = readFileSync(
  fileURLToPath(new URL('../app/layout.tsx', import.meta.url)),
  'utf8',
)

/**
 * next/font never registers a font under its human name: it generates an
 * internal family and exposes it through a CSS variable. Emitting
 * `"Playfair Display", ui-serif, …` therefore falls straight through to the
 * fallback on any device without that font installed locally.
 */
describe('fontFamilyStack', () => {
  it('points at a CSS variable rather than the bare family name', () => {
    for (const font of THEME_FONTS) {
      const stack = fontFamilyStack(font)
      expect(stack, `${font} must resolve through a variable`).toMatch(
        /^var\(--font-[a-z-]+\)/,
      )
      expect(stack, `${font} must not rely on the raw family name`).not.toMatch(
        new RegExp(`^"${font}"`),
      )
    }
  })

  it('keeps a serif fallback for the serif faces and sans for the rest', () => {
    expect(fontFamilyStack('Playfair Display')).toContain('ui-serif')
    expect(fontFamilyStack('Instrument Serif')).toContain('ui-serif')
    expect(fontFamilyStack('Fraunces')).toContain('ui-serif')
    expect(fontFamilyStack('Geist')).toContain('ui-sans-serif')
    expect(fontFamilyStack('DM Sans')).toContain('ui-sans-serif')
    expect(fontFamilyStack('Space Grotesk')).toContain('ui-sans-serif')
    expect(fontFamilyStack('Inter')).toContain('ui-sans-serif')
  })
})

describe('root layout', () => {
  it('loads every theme font and exposes its variable on <html>', () => {
    for (const font of THEME_FONTS) {
      const variable = fontFamilyStack(font).match(/--font-[a-z-]+/)?.[0]
      expect(variable, `${font} needs a variable`).toBeDefined()
      expect(
        layout,
        `${font} must declare ${variable} via next/font`,
      ).toContain(`variable: '${variable}'`)
    }
  })

  it('applies every declared font variable to the html element', () => {
    // Declaring a font without putting its variable on <html> leaves the
    // storefront resolving var(--font-x) to nothing.
    const bundle = layout.match(
      /const THEME_FONT_VARIABLES = \[([\s\S]*?)\]/,
    )?.[1]
    expect(bundle, 'the font variables must be bundled').toBeDefined()

    const applied = (bundle ?? '').match(/\.variable/g) ?? []
    expect(applied).toHaveLength(THEME_FONTS.length)

    const className = layout.match(/className=\{`([^`]+)`\}/)?.[1] ?? ''
    expect(className).toContain('THEME_FONT_VARIABLES')
  })
})
