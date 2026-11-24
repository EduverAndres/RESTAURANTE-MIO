import { describe, expect, it } from 'vitest'
import {
  canonicalRedirectUrl,
  type CanonicalRedirectInput,
} from '@/lib/http/canonical-host'

const SITE = 'http://cerquita.duckdns.org'

function redirectFor(
  host: string,
  overrides: Partial<CanonicalRedirectInput> = {},
): string | null {
  return canonicalRedirectUrl({
    headers: new Headers({ host }),
    method: 'GET',
    pathname: '/login',
    search: '',
    siteUrl: SITE,
    rootDomain: 'cerquita.duckdns.org',
    production: true,
    ...overrides,
  })
}

describe('canonicalRedirectUrl', () => {
  it('sends the bare IP and the old sslip.io name to the official address', () => {
    expect(redirectFor('44.213.146.211')).toBe(
      'http://cerquita.duckdns.org/login',
    )
    expect(redirectFor('44-213-146-211.sslip.io')).toBe(
      'http://cerquita.duckdns.org/login',
    )
    expect(redirectFor('www.cerquita.duckdns.org')).toBe(
      'http://cerquita.duckdns.org/login',
    )
  })

  it('keeps the path and the query, so printed table QR codes still open', () => {
    expect(
      redirectFor('44.213.146.211', {
        pathname: '/t/la-parrilla/mesa/abc123',
        search: '?from=qr',
      }),
    ).toBe('http://cerquita.duckdns.org/t/la-parrilla/mesa/abc123?from=qr')
  })

  it('serves the official host, loopback and LAN hosts as they are', () => {
    expect(redirectFor('cerquita.duckdns.org')).toBeNull()
    expect(redirectFor('CERQUITA.duckdns.org')).toBeNull()
    for (const host of ['localhost:3000', '127.0.0.1:3000', '10.0.0.5']) {
      expect(redirectFor(host)).toBeNull()
    }
  })

  it('trusts the proxy’s forwarded host over the raw one', () => {
    const headers = new Headers({
      host: '127.0.0.1:3000',
      'x-forwarded-host': '44-213-146-211.sslip.io',
    })
    expect(redirectFor('', { headers })).toBe(
      'http://cerquita.duckdns.org/login',
    )
  })

  it('leaves store subdomains alone: they are official too', () => {
    expect(redirectFor('la-parrilla.cerquita.duckdns.org')).toBeNull()
  })

  it('never redirects webhooks, APIs or posted forms', () => {
    expect(
      redirectFor('44-213-146-211.sslip.io', {
        method: 'POST',
        pathname: '/api/webhooks/wompi',
      }),
    ).toBeNull()
    expect(
      redirectFor('44.213.146.211', { pathname: '/api/health' }),
    ).toBeNull()
    expect(redirectFor('44.213.146.211', { method: 'POST' })).toBeNull()
    expect(redirectFor('44.213.146.211', { method: 'HEAD' })).toBe(
      'http://cerquita.duckdns.org/login',
    )
  })

  it('aims at the site URL whatever a forged host says', () => {
    expect(redirectFor('evil.example')).toBe(
      'http://cerquita.duckdns.org/login',
    )
  })

  it('does nothing outside production', () => {
    expect(redirectFor('44.213.146.211', { production: false })).toBeNull()
  })
})
