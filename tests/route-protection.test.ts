import { readdirSync, readFileSync, statSync } from 'node:fs'
import { join, relative, sep } from 'node:path'
import { describe, expect, it } from 'vitest'
import { requiredRolesFor } from '@/lib/auth/roles'

// Every URL the app serves is classified on purpose. The middleware is
// allow-by-default (only the prefixes in lib/auth/roles.ts are gated), so a
// new private page under a new prefix would ship public without anyone
// noticing. This test walks app/ and fails until each page and route handler
// is either gated by the middleware or listed below as public, with the
// reason it is safe.

const APP_DIR = join(__dirname, '..', 'app')

/** Pages anyone may open. */
const PUBLIC_PAGES: Record<string, string> = {
  '/': 'marketplace home',
  '/para-restaurantes': 'marketing',
  '/cookies': 'legal document',
  '/legal': 'legal index',
  '/privacidad': 'legal document',
  '/proteccion-al-consumidor': 'legal document',
  '/terminos': 'legal document',
  '/terminos-aliados': 'legal document',
  '/login': 'auth form',
  '/register': 'auth form',
  '/forgot-password': 'auth form',
  '/offline': 'PWA fallback',
  '/t/[slug]': 'public storefront',
  '/t/[slug]/mesa/[token]': 'table QR entry; the token is the credential',
  '/t/[slug]/mesa/[token]/checkout': 'table checkout; token-scoped',
  '/t/[slug]/mesa/[token]/pedido/[orderId]':
    'guest order tracking; token + cookie-scoped',
}

/**
 * Pages outside the gated prefixes that guard themselves; each must contain
 * the listed check, so removing it fails this test.
 */
const SELF_GUARDED_PAGES: Record<string, RegExp> = {
  '/aceptar-politicas': /if \(!user\) redirect\('\/login'\)/,
  '/t/[slug]/preview':
    /if \(!user\) notFound\(\)[\s\S]*\.eq\('owner_id', user\.id\)/,
}

/** Route handlers and how each one authenticates its caller. */
const ROUTE_HANDLERS: Record<string, string> = {
  '/api/health': 'public liveness probe; returns no data',
  '/api/webhooks/wompi': 'Wompi event signature (checksum) verified',
  '/api/webhooks/mercadopago': 'Mercado Pago x-signature verified',
  '/auth/callback': 'one-time token_hash / PKCE code verified by Supabase',
  '/auth/sign-out': 'POST only; acts on the caller’s own session',
}

function walk(dir: string, found: string[] = []): string[] {
  for (const entry of readdirSync(dir)) {
    const path = join(dir, entry)
    if (statSync(path).isDirectory()) walk(path, found)
    else if (entry === 'page.tsx' || entry === 'route.ts') found.push(path)
  }
  return found
}

/** app/(public)/t/[slug]/page.tsx -> /t/[slug] (route groups dropped). */
function urlOf(file: string): string {
  const segments = relative(APP_DIR, file)
    .split(sep)
    .slice(0, -1)
    .filter((segment) => !/^\(.*\)$/.test(segment))
  return `/${segments.join('/')}`
}

const files = walk(APP_DIR)
const pages = files.filter((file) => file.endsWith('page.tsx'))
const routes = files.filter((file) => file.endsWith('route.ts'))

describe('every page is gated or deliberately public', () => {
  it.each(pages.map((file) => [urlOf(file), file]))('%s', (url, file) => {
    const gated = requiredRolesFor(url.replace(/\[[^\]]+\]/g, 'x')) !== null
    const isPublic = url in PUBLIC_PAGES
    const selfGuard = SELF_GUARDED_PAGES[url]

    if (selfGuard) {
      expect(readFileSync(file, 'utf8')).toMatch(selfGuard)
      return
    }
    expect(
      gated || isPublic,
      `${url} is neither protected by the middleware (lib/auth/roles.ts) ` +
        'nor listed as public in tests/route-protection.test.ts',
    ).toBe(true)
    // A public page must not also sit under a gated prefix (contradiction).
    if (isPublic) expect(gated).toBe(false)
  })

  it('lists no public page that no longer exists', () => {
    const urls = new Set(pages.map(urlOf))
    for (const url of [
      ...Object.keys(PUBLIC_PAGES),
      ...Object.keys(SELF_GUARDED_PAGES),
    ]) {
      expect(urls.has(url), `${url} is listed but has no page`).toBe(true)
    }
  })
})

describe('every route handler states how it authenticates', () => {
  it.each(routes.map((file) => [urlOf(file)]))('%s', (url) => {
    expect(
      ROUTE_HANDLERS[url],
      `${url} must be reviewed and listed in ROUTE_HANDLERS`,
    ).toBeTruthy()
  })
})

describe('protected areas re-check the role in their layout', () => {
  // Defence in depth: the middleware gates the path, and the layout refuses
  // to render for the wrong role even if the middleware were bypassed.
  it.each([
    ['dashboard/layout.tsx', /requireRole\(\s*\['merchant', 'admin'\]/],
    ['admin/layout.tsx', /requireRole\(\['admin'\]/],
    ['courier/layout.tsx', /requireRole\(\['courier', 'admin'\]/],
    ['(protected)/layout.tsx', /requireUser\(/],
  ])('%s', (layout, guard) => {
    expect(readFileSync(join(APP_DIR, layout), 'utf8')).toMatch(guard)
  })
})
