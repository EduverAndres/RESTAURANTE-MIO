// @vitest-environment node
// This suite only reads a stylesheet as text; under jsdom `import.meta.url`
// is not a file:// URL, so it cannot be resolved back to a path.
import { readFileSync } from 'node:fs'
import { fileURLToPath } from 'node:url'
import { describe, expect, it } from 'vitest'
import { contrastRatio } from '@/lib/color/contrast'

// Normalised to LF before matching: on Windows a checkout with
// core.autocrlf=true writes the stylesheet with CRLF, and the block
// patterns below anchor on the newline that follows an opening brace.
const css = readFileSync(
  fileURLToPath(new URL('../app/globals.css', import.meta.url)),
  'utf8',
).replace(/\r\n/g, '\n')

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

  // The plain amber is a fill, not an ink: as text on cream it measures about
  // 2:1. Stars and warning glyphs on light surfaces use the strong variant.
  it('keeps the plain accent off light text and the strong one above AA', () => {
    expect(contrastRatio(t.accent, t.background)).toBeLessThan(AA)
    expect(
      contrastRatio(t['accent-strong'], t.background),
    ).toBeGreaterThanOrEqual(AA)
    expect(contrastRatio(t['accent-strong'], t.card)).toBeGreaterThanOrEqual(AA)
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

  it('meets AA for the strong accent on background and cards', () => {
    expect(
      contrastRatio(t['accent-strong'], t.background),
    ).toBeGreaterThanOrEqual(AA)
    expect(contrastRatio(t['accent-strong'], t.card)).toBeGreaterThanOrEqual(AA)
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

describe('app surfaces (Phase 6)', () => {
  it('declares the horizontal rail as a utility that snaps and hides its bar', () => {
    expect(css).toMatch(/@utility rail /)
    expect(css).toMatch(/scroll-snap-type:\s*x mandatory/)
    expect(css).toMatch(/scrollbar-width:\s*none/)
  })

  it('declares the confirmation tick as a dash animation, not an opacity fade', () => {
    // Reduced motion collapses the duration to 1ms, which leaves the tick
    // fully drawn — the animation only ever removes an offset, so the mark is
    // never the thing that is hidden.
    expect(css).toMatch(/@keyframes check-draw/)
    expect(css).toMatch(/stroke-dashoffset:\s*var\(--check-length/)
    expect(css).toMatch(/--animate-check-draw:\s*check-draw/)
  })

  it('exposes one header height for every sticky column in the app', () => {
    expect(css).toMatch(/--app-header-h:\s*4rem/)
  })

  it('clears AA for the alert label on an alert-tinted card', () => {
    // The Kanban's "Con retraso" badge. The token is a `color-mix`, so the
    // stylesheet can only be asserted structurally; the measured ratio is
    // what the axe audit in e2e/merchant-kanban.spec.ts enforces.
    expect(css).toMatch(
      /--destructive-on-tint:\s*color-mix\(in oklch, var\(--destructive\) \d+%, #000000\)/,
    )
    expect(css).toMatch(
      /--color-destructive-on-tint:\s*var\(--destructive-on-tint\)/,
    )
  })
})

describe('marketing motion (Fase 3)', () => {
  const names = rootTokenNames()

  /** The selector of the rule that contains `index`. */
  function selectorAt(index: number): string {
    const head = css.slice(0, index)
    const open = head.lastIndexOf('{')
    return head.slice(head.lastIndexOf('\n', open) + 1, open).trim()
  }

  /** The condition of the closest `@media` that opens before `index`. */
  function mediaAt(index: number): string | undefined {
    const head = css.slice(0, index)
    return Array.from(head.matchAll(/@media [^{]*?\(([^)]+)\)/g)).pop()?.[1]
  }

  it.each([
    'reveal-shift',
    'reveal-range',
    'demo-loop',
    'marquee-duration',
    'marquee-gap',
  ])('declares --%s in :root', (name) => {
    expect(names).toContain(name)
  })

  it('never hides a reveal block outside the animation itself', () => {
    // No unconditional `.reveal { … }`: the resting state is the visible one,
    // so the block shows without JavaScript and without support.
    expect(css).not.toMatch(/^\.reveal\s*\{/m)
    const timeline = css.indexOf('animation-timeline: view();')
    expect(timeline).toBeGreaterThan(-1)
    expect(css.slice(0, timeline)).toContain(
      '@supports (animation-timeline: view())',
    )
    expect(mediaAt(timeline)).toBe('prefers-reduced-motion: no-preference')
    expect(selectorAt(timeline)).toContain(
      ":root:not([data-motion='reduce']) .reveal",
    )
  })

  it('runs every demo and marquee loop only when both motion signals allow it', () => {
    const loops = Array.from(
      css.matchAll(/animation: (order-demo-|board-demo-|marquee-scroll)/g),
    )
    expect(loops.length).toBeGreaterThan(10)
    for (const loop of loops) {
      expect(mediaAt(loop.index)).toBe('prefers-reduced-motion: no-preference')
      expect(selectorAt(loop.index)).toMatch(
        /^:root:not\(\[data-motion='reduce'\]\) /,
      )
    }
  })

  it('stops the marquee outright with either reduced-motion signal', () => {
    expect(css).toMatch(
      /@media \(prefers-reduced-motion: reduce\) \{[\s\S]*?\.marquee-track \{\n\s*animation: none;/,
    )
    expect(css).toMatch(
      /\[data-motion='reduce'\] \.marquee-track \{\n\s*animation: none;/,
    )
    expect(css).toMatch(/\.marquee:is\(:hover, :focus-within\) \.marquee-track/)
  })
})
