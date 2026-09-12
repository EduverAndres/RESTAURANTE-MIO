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
