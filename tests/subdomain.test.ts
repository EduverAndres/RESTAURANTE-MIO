import { describe, expect, it } from 'vitest'
import {
  RESERVED_SUBDOMAINS,
  rewriteForStore,
  storePublicUrl,
  storeSlugFromHost,
} from '@/lib/subdomain'

const ROOT = 'tienda.app'

describe('storeSlugFromHost', () => {
  it('extracts the slug from a store subdomain', () => {
    expect(storeSlugFromHost('la-parrilla.tienda.app', ROOT)).toBe(
      'la-parrilla',
    )
  })

  it('is case-insensitive', () => {
    expect(storeSlugFromHost('LA-PARRILLA.TIENDA.APP', ROOT)).toBe(
      'la-parrilla',
    )
  })

  it('strips the port from the host', () => {
    expect(storeSlugFromHost('la-parrilla.tienda.app:3000', ROOT)).toBe(
      'la-parrilla',
    )
  })

  it('returns null for the bare root domain', () => {
    expect(storeSlugFromHost('tienda.app', ROOT)).toBeNull()
    expect(storeSlugFromHost('tienda.app:3000', ROOT)).toBeNull()
  })

  it('returns null for every reserved subdomain', () => {
    for (const reserved of RESERVED_SUBDOMAINS) {
      expect(storeSlugFromHost(`${reserved}.tienda.app`, ROOT)).toBeNull()
    }
  })

  it('returns null for localhost and 127.0.0.1', () => {
    expect(storeSlugFromHost('localhost', ROOT)).toBeNull()
    expect(storeSlugFromHost('localhost:3000', ROOT)).toBeNull()
    expect(storeSlugFromHost('127.0.0.1:3000', ROOT)).toBeNull()
  })

  it('returns null for Vercel preview hosts', () => {
    expect(
      storeSlugFromHost('tienda-git-main-eduver.vercel.app', ROOT),
    ).toBeNull()
  })

  it('returns null for a nested subdomain', () => {
    expect(storeSlugFromHost('a.b.tienda.app', ROOT)).toBeNull()
  })

  it('returns null for a host outside the root domain', () => {
    expect(storeSlugFromHost('example.com', ROOT)).toBeNull()
  })

  it('returns null when the host is missing', () => {
    expect(storeSlugFromHost(null, ROOT)).toBeNull()
    expect(storeSlugFromHost(undefined, ROOT)).toBeNull()
    expect(storeSlugFromHost('', ROOT)).toBeNull()
  })

  it('treats a root domain with a port the same way (local dev)', () => {
    expect(
      storeSlugFromHost('la-parrilla.localhost:3000', 'localhost:3000'),
    ).toBe('la-parrilla')
    expect(storeSlugFromHost('localhost:3000', 'localhost:3000')).toBeNull()
  })
})

describe('rewriteForStore', () => {
  const slug = 'la-parrilla'

  it('rewrites the store home page', () => {
    expect(rewriteForStore('/', slug)).toBe('/t/la-parrilla')
  })

  it('rewrites the table ordering flow', () => {
    expect(rewriteForStore('/mesa/abc123', slug)).toBe(
      '/t/la-parrilla/mesa/abc123',
    )
    expect(rewriteForStore('/mesa/abc123/checkout', slug)).toBe(
      '/t/la-parrilla/mesa/abc123/checkout',
    )
    expect(rewriteForStore('/mesa/abc123/pedido/order-1', slug)).toBe(
      '/t/la-parrilla/mesa/abc123/pedido/order-1',
    )
  })

  it.each([
    '/t/other-store',
    '/_next/static/chunk.js',
    '/api/webhooks/wompi',
    '/auth/callback',
    '/login',
    '/orders/order-1',
    '/checkout',
    '/account',
    '/dashboard',
    '/dashboard/menu',
    '/courier',
    '/admin',
  ])('leaves %s untouched', (pathname) => {
    expect(rewriteForStore(pathname, slug)).toBe(pathname)
  })
})

describe('storePublicUrl', () => {
  it('builds a subdomain URL when the root domain is a real domain', () => {
    expect(
      storePublicUrl({
        slug: 'la-parrilla',
        siteUrl: 'https://tienda.app',
        rootDomain: 'tienda.app',
      }),
    ).toBe('https://la-parrilla.tienda.app')
  })

  it('falls back to a path under the site URL for local development', () => {
    expect(
      storePublicUrl({
        slug: 'la-parrilla',
        siteUrl: 'http://localhost:3000',
        rootDomain: 'localhost:3000',
      }),
    ).toBe('http://localhost:3000/t/la-parrilla')

    expect(
      storePublicUrl({
        slug: 'la-parrilla',
        siteUrl: 'http://localhost:3000',
        rootDomain: 'localhost',
      }),
    ).toBe('http://localhost:3000/t/la-parrilla')
  })

  it('trims a trailing slash from the site URL in path mode', () => {
    expect(
      storePublicUrl({
        slug: 'la-parrilla',
        siteUrl: 'http://localhost:3000/',
        rootDomain: 'localhost:3000',
      }),
    ).toBe('http://localhost:3000/t/la-parrilla')
  })
})
