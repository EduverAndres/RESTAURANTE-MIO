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
}

/**
 * Public link to a store's page. Subdomains only make sense once a real
 * domain is wired up (DNS + `rootDomain` containing a dot); local
 * development keeps the `/t/<slug>` path so QR codes and share links keep
 * working without wildcard DNS.
 */
export function storePublicUrl({
  slug,
  siteUrl,
  rootDomain,
}: StorePublicUrlInput): string {
  const root = rootDomain.toLowerCase()
  const isRealDomain =
    root.includes('.') &&
    root !== 'localhost' &&
    !hostWithoutPort(root).endsWith('.localhost')

  if (isRealDomain) {
    return `https://${slug}.${hostWithoutPort(root)}`
  }

  return `${siteUrl.replace(/\/+$/, '')}/t/${slug}`
}
