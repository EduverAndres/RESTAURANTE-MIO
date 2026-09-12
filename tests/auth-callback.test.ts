import { describe, expect, it } from 'vitest'
import {
  buildAuthRedirectUrl,
  callbackErrorFromParams,
  mapCallbackErrorCode,
  resolveCallback,
} from '@/lib/auth/callback'

const params = (query: string) => new URLSearchParams(query)

describe('resolveCallback', () => {
  it('reports GoTrue errors before looking at tokens or codes', () => {
    expect(
      resolveCallback(
        params(
          'error=access_denied&error_code=otp_expired&error_description=Email+link+is+invalid+or+has+expired&code=abc',
        ),
      ),
    ).toEqual({ kind: 'error', code: 'expired' })
    expect(resolveCallback(params('error=access_denied'))).toEqual({
      kind: 'error',
      code: 'invalid',
    })
    expect(resolveCallback(params('error=server_error'))).toEqual({
      kind: 'error',
      code: 'callback',
    })
  })

  it('resolves token_hash links for whitelisted types', () => {
    expect(
      resolveCallback(
        params('token_hash=abc123&type=signup&next=%2Fdashboard'),
      ),
    ).toEqual({
      kind: 'token',
      tokenHash: 'abc123',
      type: 'signup',
      next: '/dashboard',
    })
    expect(
      resolveCallback(
        params(
          'token_hash=abc123&type=recovery&next=%2Faccount%2Freset-password',
        ),
      ),
    ).toEqual({
      kind: 'token',
      tokenHash: 'abc123',
      type: 'recovery',
      next: '/account/reset-password',
    })
    for (const type of ['email', 'magiclink', 'email_change', 'invite']) {
      expect(resolveCallback(params(`token_hash=x&type=${type}`))).toEqual({
        kind: 'token',
        tokenHash: 'x',
        type,
        next: null,
      })
    }
  })

  it('rejects token links with an unknown or missing type', () => {
    expect(resolveCallback(params('token_hash=abc&type=sms'))).toEqual({
      kind: 'error',
      code: 'invalid',
    })
    expect(resolveCallback(params('token_hash=abc'))).toEqual({
      kind: 'error',
      code: 'invalid',
    })
  })

  it('resolves PKCE codes', () => {
    expect(resolveCallback(params('code=xyz&next=%2Forders%2F1'))).toEqual({
      kind: 'code',
      code: 'xyz',
      next: '/orders/1',
    })
    expect(resolveCallback(params('code=xyz'))).toEqual({
      kind: 'code',
      code: 'xyz',
      next: null,
    })
  })

  it('prefers the token over a code when both are present', () => {
    expect(
      resolveCallback(params('code=xyz&token_hash=t&type=signup')),
    ).toEqual({ kind: 'token', tokenHash: 't', type: 'signup', next: null })
  })

  it('sanitises next so it can never leave the origin or loop into auth', () => {
    expect(
      resolveCallback(params('code=xyz&next=https%3A%2F%2Fevil.com')),
    ).toEqual({ kind: 'code', code: 'xyz', next: null })
    expect(resolveCallback(params('code=xyz&next=%2Flogin'))).toEqual({
      kind: 'code',
      code: 'xyz',
      next: null,
    })
    expect(
      resolveCallback(params('token_hash=t&type=signup&next=%2F%2Fevil.com')),
    ).toEqual({ kind: 'token', tokenHash: 't', type: 'signup', next: null })
  })

  it('reports a missing payload', () => {
    expect(resolveCallback(params(''))).toEqual({
      kind: 'error',
      code: 'missing',
    })
    expect(resolveCallback(params('next=%2Fdashboard'))).toEqual({
      kind: 'error',
      code: 'missing',
    })
  })
})

describe('mapCallbackErrorCode', () => {
  it('maps expiry style codes to expired', () => {
    expect(mapCallbackErrorCode('otp_expired')).toBe('expired')
    expect(mapCallbackErrorCode('flow_state_expired')).toBe('expired')
  })

  it('maps tampering and verifier mismatches to invalid', () => {
    expect(mapCallbackErrorCode('access_denied')).toBe('invalid')
    expect(mapCallbackErrorCode('bad_code_verifier')).toBe('invalid')
    expect(mapCallbackErrorCode('flow_state_not_found')).toBe('invalid')
    expect(mapCallbackErrorCode('otp_disabled')).toBe('invalid')
  })

  it('falls back to the generic callback key', () => {
    expect(mapCallbackErrorCode('unexpected_failure')).toBe('callback')
    expect(mapCallbackErrorCode(null)).toBe('callback')
    expect(mapCallbackErrorCode(undefined)).toBe('callback')
  })
})

describe('callbackErrorFromParams', () => {
  it('reads the error shape GoTrue puts in the hash fragment', () => {
    const fragment =
      'error=access_denied&error_code=otp_expired&error_description=Email+link+is+invalid+or+has+expired'
    expect(callbackErrorFromParams(params(fragment))).toBe('expired')
  })

  it('returns null when no error is present', () => {
    expect(callbackErrorFromParams(params('code=abc'))).toBeNull()
    expect(callbackErrorFromParams(params(''))).toBeNull()
  })
})

describe('buildAuthRedirectUrl', () => {
  it('always includes a next query so templates can append with &', () => {
    expect(buildAuthRedirectUrl('http://localhost:3000', '/dashboard')).toBe(
      'http://localhost:3000/auth/callback?next=%2Fdashboard',
    )
    expect(
      buildAuthRedirectUrl('http://localhost:3000', '/account/reset-password'),
    ).toBe(
      'http://localhost:3000/auth/callback?next=%2Faccount%2Freset-password',
    )
  })

  it('falls back to the home path for unsafe targets', () => {
    expect(buildAuthRedirectUrl('https://tienda.app', 'https://evil.com')).toBe(
      'https://tienda.app/auth/callback?next=%2F',
    )
    expect(buildAuthRedirectUrl('https://tienda.app', '/login')).toBe(
      'https://tienda.app/auth/callback?next=%2F',
    )
    expect(buildAuthRedirectUrl('https://tienda.app', null)).toBe(
      'https://tienda.app/auth/callback?next=%2F',
    )
  })

  it('tolerates a trailing slash on the site url', () => {
    expect(buildAuthRedirectUrl('https://tienda.app/', '/courier')).toBe(
      'https://tienda.app/auth/callback?next=%2Fcourier',
    )
  })
})
