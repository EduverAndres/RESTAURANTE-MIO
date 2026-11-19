import { describe, expect, it } from 'vitest'
import { hstsHeaderValue } from '@/lib/http/hsts'
import nextConfig from '@/next.config'

/**
 * The header policy is part of the deployment contract, not a detail of the
 * build: a dropped HSTS or an accidentally enforcing CSP is a production
 * incident nobody notices locally. These assertions pin both.
 */
async function headerMap(path = '/'): Promise<Map<string, string>> {
  const rules = (await nextConfig.headers?.()) ?? []
  const entries = new Map<string, string>()
  for (const rule of rules) {
    if (rule.source !== '/:path*' && rule.source !== path) continue
    for (const header of rule.headers) entries.set(header.key, header.value)
  }
  return entries
}

describe('security headers', () => {
  it('sends HSTS for two years', async () => {
    const headers = await headerMap()
    expect(headers.get('Strict-Transport-Security')).toBe(
      hstsHeaderValue(process.env),
    )
    expect(headers.get('Strict-Transport-Security')).toMatch(
      /^max-age=63072000(; includeSubDomains)?$/,
    )
  })

  // includeSubDomains on a domain whose certificate covers only the apex
  // would lock every subdomain out for two years; preload is a manual call.
  it('covers subdomains only with store subdomains on, and never preloads', () => {
    expect(hstsHeaderValue({})).toBe('max-age=63072000')
    expect(hstsHeaderValue({ NEXT_PUBLIC_STORE_SUBDOMAINS: 'false' })).toBe(
      'max-age=63072000',
    )
    expect(hstsHeaderValue({ NEXT_PUBLIC_STORE_SUBDOMAINS: 'true' })).toBe(
      'max-age=63072000; includeSubDomains',
    )
  })

  it('sends the baseline hardening headers', async () => {
    const headers = await headerMap()
    expect(headers.get('X-Content-Type-Options')).toBe('nosniff')
    expect(headers.get('Referrer-Policy')).toBe(
      'strict-origin-when-cross-origin',
    )
    expect(headers.get('X-Frame-Options')).toBe('SAMEORIGIN')
  })

  it('keeps geolocation on self and denies the camera', async () => {
    const policy = (await headerMap()).get('Permissions-Policy') ?? ''
    expect(policy).toContain('geolocation=(self)')
    expect(policy).toContain('camera=()')
    expect(policy).toContain('microphone=()')
  })

  it('ships the CSP in report-only mode and never enforces it', async () => {
    const headers = await headerMap()
    expect(headers.has('Content-Security-Policy')).toBe(false)
    const csp = headers.get('Content-Security-Policy-Report-Only')
    expect(csp).toBeTypeOf('string')
    expect(csp).toContain("default-src 'self'")
    // Per-store theming writes inline styles; Leaflet injects its own too.
    expect(csp).toContain("style-src 'self' 'unsafe-inline'")
    // Leaflet tiles, Supabase storage and Unsplash placeholders.
    expect(csp).toContain('https://*.tile.openstreetmap.org')
    expect(csp).toContain('https://images.unsplash.com')
    // Supabase REST plus realtime over websockets.
    expect(csp).toContain('wss://*.supabase.co')
  })

  it('grants the browser no Wompi origin, because the browser never calls one', async () => {
    const csp = (await headerMap()).get('Content-Security-Policy-Report-Only')
    // `fetchWompiTransaction` lives in a `server-only` module, so the gateway
    // API is only ever reached from a Server Component or the webhook route.
    // Checkout does leave for `checkout.wompi.co`, but as a top-level
    // `window.location.assign` navigation, which no directive here governs.
    expect(csp).not.toContain('wompi.co')
  })
})
