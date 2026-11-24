// One public address. A visitor who reaches the app on another public host
// (the instance's bare IP, an old sslip.io test name, `www.`) is sent to the
// same path on NEXT_PUBLIC_SITE_URL. Otherwise each host is its own origin:
// separate cookies and sessions, separate push subscriptions, and pages that
// keep working on an address the app no longer uses for its links.
//
// Pure: no Next.js imports (runs in the edge middleware, tested on its own).
import { foreignPublicHost } from '@/lib/http/request-origin'
import { storeSlugFromHost } from '@/lib/subdomain'

export interface CanonicalRedirectInput {
  headers: Headers
  method: string
  pathname: string
  search: string
  siteUrl: string
  rootDomain: string | null | undefined
  /** Only production redirects; development serves any host. */
  production: boolean
}

/**
 * The official URL to send this request to, or null to serve it here.
 *
 * Served as is:
 *  - the site's own host, and loopback / private hosts (health checks, local
 *    runs; `foreignPublicHost` already leaves them out);
 *  - store subdomains of the root domain, which are official too;
 *  - `/api/*`: a payment provider still posting webhooks to an old address
 *    must not get a redirect it will not follow;
 *  - anything but GET and HEAD: a form posted from a page opened on the old
 *    host finishes there instead of losing its body.
 *
 * The target is always the configured site URL, never a header, so a forged
 * `Host` cannot turn this into an open redirect.
 */
export function canonicalRedirectUrl({
  headers,
  method,
  pathname,
  search,
  siteUrl,
  rootDomain,
  production,
}: CanonicalRedirectInput): string | null {
  if (!production) return null
  if (method !== 'GET' && method !== 'HEAD') return null
  if (pathname === '/api' || pathname.startsWith('/api/')) return null

  const host = foreignPublicHost(headers, siteUrl)
  if (!host) return null
  if (storeSlugFromHost(host, rootDomain)) return null

  return `${siteUrl.replace(/\/+$/, '')}${pathname}${search}`
}
