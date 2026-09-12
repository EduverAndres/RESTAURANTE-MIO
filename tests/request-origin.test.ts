import { describe, expect, it } from 'vitest'
import { requestOrigin } from '@/lib/http/request-origin'

const FALLBACK = 'https://tienda.app'

function headersOf(entries: Record<string, string>): Headers {
  return new Headers(entries)
}

describe('requestOrigin', () => {
  it('prefers forwarded proto and host set by a proxy', () => {
    expect(
      requestOrigin(
        headersOf({
          host: '0.0.0.0:3000',
          'x-forwarded-proto': 'https',
          'x-forwarded-host': 'tienda.app',
        }),
        FALLBACK,
      ),
    ).toBe('https://tienda.app')
  })

  it('uses only the first value of a comma separated forwarded header', () => {
    expect(
      requestOrigin(
        headersOf({
          host: '10.0.0.5:3000',
          'x-forwarded-proto': 'https, http',
          'x-forwarded-host': 'tienda.app, internal.lan',
        }),
        FALLBACK,
      ),
    ).toBe('https://tienda.app')
  })

  it('treats localhost as plain http', () => {
    expect(requestOrigin(headersOf({ host: 'localhost:3000' }), FALLBACK)).toBe(
      'http://localhost:3000',
    )
    expect(
      requestOrigin(headersOf({ host: 'demo.localhost:3000' }), FALLBACK),
    ).toBe('http://demo.localhost:3000')
  })

  it('treats private LAN addresses as plain http', () => {
    expect(
      requestOrigin(headersOf({ host: '192.168.1.16:3000' }), FALLBACK),
    ).toBe('http://192.168.1.16:3000')
    expect(requestOrigin(headersOf({ host: '10.1.2.3:3000' }), FALLBACK)).toBe(
      'http://10.1.2.3:3000',
    )
    expect(
      requestOrigin(headersOf({ host: '172.20.0.9:3000' }), FALLBACK),
    ).toBe('http://172.20.0.9:3000')
    expect(requestOrigin(headersOf({ host: '127.0.0.1:3000' }), FALLBACK)).toBe(
      'http://127.0.0.1:3000',
    )
  })

  it('never returns the 0.0.0.0 bind address', () => {
    expect(requestOrigin(headersOf({ host: '0.0.0.0:3000' }), FALLBACK)).toBe(
      'http://localhost:3000',
    )
    expect(requestOrigin(headersOf({ host: '0.0.0.0' }), FALLBACK)).toBe(
      'http://localhost',
    )
  })

  it('defaults public hosts to https', () => {
    expect(requestOrigin(headersOf({ host: 'tienda.app' }), FALLBACK)).toBe(
      'https://tienda.app',
    )
    expect(
      requestOrigin(
        headersOf({ host: 'tienda.app', 'x-forwarded-proto': 'http' }),
        FALLBACK,
      ),
    ).toBe('http://tienda.app')
  })

  it('falls back when there is no host header', () => {
    expect(requestOrigin(headersOf({}), FALLBACK)).toBe(FALLBACK)
    expect(requestOrigin(headersOf({ host: '   ' }), FALLBACK)).toBe(FALLBACK)
  })

  it('keeps bracketed ipv6 hosts intact', () => {
    expect(requestOrigin(headersOf({ host: '[::1]:3000' }), FALLBACK)).toBe(
      'http://[::1]:3000',
    )
  })

  it('accepts the site url host, with or without an explicit port', () => {
    expect(
      requestOrigin(
        headersOf({ host: 'tienda.app:8443' }),
        'https://tienda.app:8443',
      ),
    ).toBe('https://tienda.app:8443')
    expect(
      requestOrigin(headersOf({ host: 'TIENDA.APP' }), 'https://tienda.app'),
    ).toBe('https://tienda.app')
  })

  it('rejects a spoofed public host and falls back to the site url', () => {
    expect(requestOrigin(headersOf({ host: 'evil.com' }), FALLBACK)).toBe(
      FALLBACK,
    )
    expect(
      requestOrigin(
        headersOf({ host: 'tienda.app', 'x-forwarded-host': 'evil.com' }),
        FALLBACK,
      ),
    ).toBe(FALLBACK)
    expect(
      requestOrigin(headersOf({ host: 'tienda.app.evil.com' }), FALLBACK),
    ).toBe(FALLBACK)
  })

  it('only accepts private hosts when explicitly allowed (non-production)', () => {
    expect(
      requestOrigin(headersOf({ host: '192.168.1.16:3000' }), FALLBACK, {
        allowPrivateHosts: false,
      }),
    ).toBe(FALLBACK)
    expect(
      requestOrigin(headersOf({ host: 'localhost:3000' }), FALLBACK, {
        allowPrivateHosts: false,
      }),
    ).toBe(FALLBACK)
    expect(
      requestOrigin(headersOf({ host: '192.168.1.16:3000' }), FALLBACK, {
        allowPrivateHosts: true,
      }),
    ).toBe('http://192.168.1.16:3000')
  })

  it('still maps 0.0.0.0 to localhost when private hosts are allowed', () => {
    expect(
      requestOrigin(headersOf({ host: '0.0.0.0:3000' }), FALLBACK, {
        allowPrivateHosts: true,
      }),
    ).toBe('http://localhost:3000')
    expect(
      requestOrigin(headersOf({ host: '0.0.0.0:3000' }), FALLBACK, {
        allowPrivateHosts: false,
      }),
    ).toBe(FALLBACK)
  })

  it('ignores a forwarded proto that is not http or https', () => {
    expect(
      requestOrigin(
        headersOf({
          host: 'localhost:3000',
          'x-forwarded-proto': 'javascript',
        }),
        FALLBACK,
      ),
    ).toBe('http://localhost:3000')
  })
})
