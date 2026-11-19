import { describe, expect, it } from 'vitest'
import { safeNextPath } from '@/lib/auth/safe-next'

describe('safeNextPath', () => {
  it('accepts relative paths that start with a single slash', () => {
    expect(safeNextPath('/dashboard')).toBe('/dashboard')
    expect(safeNextPath('/orders/abc?tab=1')).toBe('/orders/abc?tab=1')
  })

  it('rejects protocol-relative and absolute URLs', () => {
    expect(safeNextPath('//evil.com')).toBeNull()
    expect(safeNextPath('https://evil.com')).toBeNull()
    expect(safeNextPath('/\\evil.com')).toBeNull()
  })

  it('rejects paths a browser would resolve to another host', () => {
    // The URL parser strips tabs and newlines: "/\t/evil.com" -> evil.com.
    expect(safeNextPath('/\t/evil.com')).toBeNull()
    expect(safeNextPath('/\n/evil.com')).toBeNull()
    expect(safeNextPath('/\u0000/evil.com')).toBeNull()
    expect(safeNextPath('/\u007f/evil.com')).toBeNull()
    for (const value of ['/%2F%2Fevil.com', '/ /evil.com', '/ok']) {
      const next = safeNextPath(value)
      if (next !== null) {
        expect(new URL(next, 'https://cerquita.app').host).toBe('cerquita.app')
      }
    }
  })

  it('keeps query and hash of a same-origin path', () => {
    expect(safeNextPath('/t/la-parrilla?mesa=3#menu')).toBe(
      '/t/la-parrilla?mesa=3#menu',
    )
  })

  it('rejects empty, missing or malformed values', () => {
    expect(safeNextPath(null)).toBeNull()
    expect(safeNextPath(undefined)).toBeNull()
    expect(safeNextPath('')).toBeNull()
    expect(safeNextPath('dashboard')).toBeNull()
    expect(safeNextPath('/login\nfoo')).toBeNull()
  })

  it('never redirects back into the auth pages', () => {
    expect(safeNextPath('/login')).toBeNull()
    expect(safeNextPath('/register?role=merchant')).toBeNull()
    expect(safeNextPath('/auth/callback')).toBeNull()
  })
})
