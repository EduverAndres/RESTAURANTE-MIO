import { env } from '@/lib/env'
import { storePublicUrl } from '@/lib/subdomain'

// The one public address of this deployment. Every absolute URL a user or a
// third party receives — redirects, table QR codes, payment return and
// webhook URLs, referral links, sitemap, canonical/OG metadata, store links —
// is built from here, so the host lives in exactly one variable:
// NEXT_PUBLIC_SITE_URL.
//
// It is inlined at BUILD time (server, edge and client bundles alike; a
// production build ignores a different value set at runtime). An instance
// whose public IP changed therefore kept sending everyone to the old one
// until it was rebuilt. Two guards make that visible instead of silent:
// scripts/deploy-lightsail.sh compares the value with the instance's public
// IP before building, and the middleware logs `site_url.host_mismatch` when
// visitors arrive on a public host that is not this one.
//
// Pure: no server-only import, so it also runs in the edge middleware.

/** `scheme://host[:port]` of an http(s) URL, or null when it is not one. */
export function normaliseSiteUrl(
  value: string | undefined | null,
): string | null {
  if (!value) return null
  try {
    const url = new URL(value.trim())
    if (url.protocol !== 'http:' && url.protocol !== 'https:') return null
    return url.origin
  } catch {
    return null
  }
}

/** Public origin of the site, without a trailing slash. */
export function siteUrl(): string {
  return (
    normaliseSiteUrl(env.NEXT_PUBLIC_SITE_URL) ??
    // env.ts already rejected a missing or malformed value at startup.
    env.NEXT_PUBLIC_SITE_URL.replace(/\/+$/, '')
  )
}

/** Absolute URL on the public site for a path such as `/orders/123`. */
export function absoluteUrl(path: string): string {
  const suffix = path.startsWith('/') ? path : `/${path}`
  return `${siteUrl()}${suffix}`
}

/** Public link to a store's page, with this deployment's settings. */
export function storeUrl(slug: string): string {
  return storePublicUrl({
    slug,
    siteUrl: siteUrl(),
    rootDomain: env.NEXT_PUBLIC_ROOT_DOMAIN,
    subdomains: env.NEXT_PUBLIC_STORE_SUBDOMAINS,
  })
}
