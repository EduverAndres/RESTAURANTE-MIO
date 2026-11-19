// Pure helpers for multi-tenant host routing. No Next.js imports so they
// stay importable from middleware, server code, client code and tests.

/** Names that can never be claimed as a store slug/subdomain. */
export const RESERVED_SUBDOMAINS = [
  'www',
  'app',
  'admin',
  'api',
  'mail',
] as const

const UNTOUCHED_PREFIXES = [
  '/t/',
  '/_next',
  '/api',
  '/auth',
  '/login',
  '/orders',
  '/checkout',
  '/account',
  '/dashboard',
  '/courier',
  '/admin',
  // Legal documents and the consent gate: a storefront's footer links to
  // them, and the middleware sends unaccepted sessions to the gate.
  '/aceptar-politicas',
  '/terminos',
  '/privacidad',
  '/cookies',
  '/proteccion-al-consumidor',
  '/legal',
  '/register',
] as const

function hostWithoutPort(host: string): string {
  return host.split(':')[0]
}

/**
 * Extracts the store slug from the request host, or null when the host does
 * not address a single store subdomain: the bare root domain, a reserved
 * name, localhost/127.0.0.1, a Vercel preview host, or a nested subdomain.
 */
export function storeSlugFromHost(
  host: string | null | undefined,
  rootDomain: string | null | undefined,
): string | null {
  if (!host || !rootDomain) return null

  const hostname = hostWithoutPort(host).toLowerCase()
  const root = hostWithoutPort(rootDomain).toLowerCase()
  if (!root) return null

  if (hostname === 'localhost' || hostname === '127.0.0.1') return null
  if (hostname.endsWith('.vercel.app')) return null
  if (hostname === root) return null
  if (!hostname.endsWith(`.${root}`)) return null

  const subdomain = hostname.slice(0, hostname.length - root.length - 1)
  if (!subdomain || subdomain.includes('.')) return null
  if ((RESERVED_SUBDOMAINS as readonly string[]).includes(subdomain)) {
    return null
  }

  return subdomain
}

function matchesUntouchedPrefix(pathname: string): boolean {
  return UNTOUCHED_PREFIXES.some(
    (prefix) => pathname === prefix || pathname.startsWith(prefix),
  )
}

/**
 * Maps a request path on a store subdomain to the path-based route that
 * actually renders it. Anything that already targets an app-wide route
 * (auth, dashboard, admin, the `/t/` tree itself, …) is left untouched so
 * cross-cutting pages keep working when opened from a store subdomain.
 */
export function rewriteForStore(pathname: string, slug: string): string {
  if (matchesUntouchedPrefix(pathname)) return pathname
  if (pathname === '/') return `/t/${slug}`
  if (pathname.startsWith('/mesa/')) return `/t/${slug}${pathname}`
  return pathname
}

export interface StorePublicUrlInput {
  slug: string
  siteUrl: string
  rootDomain: string
  /**
   * Link to `https://<slug>.<rootDomain>` instead of the path form. Only
   * turn it on once wildcard DNS and a wildcard TLS certificate exist for
   * the root domain: without them the subdomain opens nothing.
   */
  subdomains?: boolean
}

/** True for a dotted IPv4 host (with or without port): it has no subdomains. */
function isIpv4Host(host: string): boolean {
  return /^\d{1,3}(\.\d{1,3}){3}$/.test(hostWithoutPort(host))
}

/** A root that can carry `<slug>.` in front of it: a named, public domain. */
function isSubdomainCapable(rootDomain: string): boolean {
  const root = hostWithoutPort(rootDomain.toLowerCase())
  return (
    root.includes('.') &&
    !root.includes('/') &&
    !root.endsWith('.localhost') &&
    !isIpv4Host(root)
  )
}

/**
 * Public link to a store's page.
 *
 * The path form `<siteUrl>/t/<slug>` is the default because it opens on any
 * host that serves the app: an IP, a domain without wildcard DNS, plain
 * http. The subdomain form used to be picked whenever the root domain had a
 * dot, which with an IP root produced `https://<slug>.3.85.1.2`, an invalid
 * URL the browser blocks (`about:blank#blocked`), and with a domain lacking
 * wildcard DNS a link that never resolved. It is now opt-in, and never for
 * an IP or localhost.
 */
export function storePublicUrl({
  slug,
  siteUrl,
  rootDomain,
  subdomains = false,
}: StorePublicUrlInput): string {
  if (subdomains && isSubdomainCapable(rootDomain)) {
    return `https://${slug}.${hostWithoutPort(rootDomain.toLowerCase())}`
  }

  return `${siteUrl.replace(/\/+$/, '')}/t/${slug}`
}
