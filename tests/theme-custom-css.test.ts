import { describe, expect, it } from 'vitest'
import { sanitizeCustomCss } from '@/lib/theme'

const SCOPE = '[data-store-theme]'

describe('sanitizeCustomCss', () => {
  it('returns null when there is nothing to keep', () => {
    expect(sanitizeCustomCss(null)).toBeNull()
    expect(sanitizeCustomCss('')).toBeNull()
    expect(sanitizeCustomCss('   \n\t ')).toBeNull()
    expect(sanitizeCustomCss('/* just a comment */')).toBeNull()
    expect(sanitizeCustomCss('{}')).toBeNull()
  })

  it('keeps a plain valid declaration block', () => {
    const css = sanitizeCustomCss('.promo { color: #ff0000; font-size: 2rem; }')
    expect(css).toContain('color: #ff0000')
    expect(css).toContain('font-size: 2rem')
    expect(css?.startsWith(SCOPE)).toBe(true)
  })

  it('scopes every selector so it cannot escape the store container', () => {
    const css = sanitizeCustomCss('.a, .b:hover { color: red }')
    expect(css).toContain(`${SCOPE} .a`)
    expect(css).toContain(`${SCOPE} .b:hover`)
  })

  it('drops selectors that try to reach outside the store container', () => {
    const css = sanitizeCustomCss(
      ':root { --x: 1 } html { color: red } body { color: red } .ok { color: red }',
    )
    expect(css).not.toContain(':root')
    expect(css).not.toMatch(/(^|\s)html\b/)
    expect(css).not.toMatch(/(^|\s)body\b/)
    expect(css).toContain(`${SCOPE} .ok`)
  })

  it('wraps bare declarations in the store scope', () => {
    const css = sanitizeCustomCss('color: red; font-weight: 800')
    expect(css).toContain(`${SCOPE} {`)
    expect(css).toContain('color: red')
    expect(css).toContain('font-weight: 800')
  })

  it('strips at-rules such as @import and @media', () => {
    const css = sanitizeCustomCss(
      '@import url("https://evil.test/x.css"); @media print { .a { color: red } } .b { color: blue }',
    )
    expect(css).not.toContain('@')
    expect(css).toContain(`${SCOPE} .b`)
    expect(css).toContain('color: blue')
  })

  it('returns null when only at-rules were supplied', () => {
    expect(sanitizeCustomCss('@import "evil.css";')).toBeNull()
    expect(sanitizeCustomCss('@charset "utf-8";')).toBeNull()
  })

  it('drops external url() but keeps data uris', () => {
    const external = sanitizeCustomCss(
      '.a { background-image: url(https://evil.test/pixel.png); color: red }',
    )
    expect(external).not.toContain('evil.test')
    expect(external).toContain('color: red')

    const inline = sanitizeCustomCss(
      '.a { background-image: url(data:image/png;base64,iVBORw0KGgo=) }',
    )
    expect(inline).toContain('data:image/png;base64,iVBORw0KGgo=')
  })

  it('drops javascript:, expression() and other legacy vectors', () => {
    expect(
      sanitizeCustomCss('.a { background: url(javascript:alert(1)) }'),
    ).toBeNull()
    expect(sanitizeCustomCss('.a { width: expression(alert(1)) }')).toBeNull()
    expect(sanitizeCustomCss('.a { behavior: url(#default#time2) }')).toBeNull()
    expect(sanitizeCustomCss('.a { -moz-binding: url(evil.xml#x) }')).toBeNull()
    expect(sanitizeCustomCss('.a { color: red }</style><script>')).toContain(
      'color: red',
    )
    expect(sanitizeCustomCss('.a { content: "</style>" }')).toBeNull()
  })

  it('strips comments that hide a payload', () => {
    const css = sanitizeCustomCss(
      '.a { color: red } /* } @import url(evil.css); { */ .b { color: blue }',
    )
    expect(css).not.toContain('@import')
    expect(css).not.toContain('evil.css')
    expect(css).toContain(`${SCOPE} .a`)
    expect(css).toContain(`${SCOPE} .b`)

    const escaped = sanitizeCustomCss('/* */@import "x";/* */.c { color: red }')
    expect(escaped).not.toContain('@')
    expect(escaped).toContain(`${SCOPE} .c`)
  })

  it('rejects backslash escapes used to smuggle at-rules', () => {
    expect(sanitizeCustomCss('.a { color: \\72 ed }')).toBeNull()
  })

  it('enforces the 4 KB cap', () => {
    const under = '.a { color: red }'
    expect(sanitizeCustomCss(under)).not.toBeNull()

    const over = `.a { color: red; }`.repeat(400)
    expect(new TextEncoder().encode(over).length).toBeGreaterThan(4096)
    expect(sanitizeCustomCss(over)).toBeNull()
  })

  it('is idempotent on its own output', () => {
    const once = sanitizeCustomCss('.a { color: red }')
    expect(once).not.toBeNull()
    expect(sanitizeCustomCss(once)).toBe(once)
  })
})
