// Resolves the origin the browser actually used to reach us. `nextUrl.origin`
// reflects the address the server is bound to (e.g. 0.0.0.0 under
// `next dev -H 0.0.0.0`, or an internal hostname behind a proxy), so redirects
// built from it can land on a host that never received the session cookies.
//
// Host headers are attacker-controlled, so the result is allow-listed: only
// the canonical site host, or (outside production) a loopback / private LAN
// host, is ever returned. Anything else falls back to the site URL, which
// keeps this from becoming a header-driven open redirect after auth.
// Pure: no Next.js or server imports (also runs in the edge middleware).

const LOOPBACK_HOSTNAMES = new Set(['localhost', '[::1]'])
const BIND_ALL_HOSTNAMES = new Set(['0.0.0.0', '[::]'])

const PRIVATE_IPV4 =
  /^(?:127\.\d{1,3}\.\d{1,3}\.\d{1,3}|10\.\d{1,3}\.\d{1,3}\.\d{1,3}|192\.168\.\d{1,3}\.\d{1,3}|172\.(?:1[6-9]|2\d|3[01])\.\d{1,3}\.\d{1,3})$/

export interface RequestOriginOptions {
  /**
   * Accept loopback and private LAN hosts (localhost, *.localhost, [::1],
   * 127/10/192.168/172.16-31). Defaults to true outside production.
   */
  allowPrivateHosts?: boolean
}

function firstValue(header: string | null): string | null {
  if (!header) return null
  const value = header.split(',')[0]?.trim() ?? ''
  return value.length > 0 ? value : null
}

function splitHost(host: string): { hostname: string; port: string } {
  if (host.startsWith('[')) {
    const end = host.indexOf(']')
    if (end !== -1) {
      return { hostname: host.slice(0, end + 1), port: host.slice(end + 1) }
    }
  }
  const separator = host.lastIndexOf(':')
  if (separator === -1) return { hostname: host, port: '' }
  return { hostname: host.slice(0, separator), port: host.slice(separator) }
}

function isPrivateHostname(hostname: string): boolean {
  return (
    LOOPBACK_HOSTNAMES.has(hostname) ||
    hostname.endsWith('.localhost') ||
    PRIVATE_IPV4.test(hostname)
  )
}

/** `host[:port]` of the site URL, lower-cased; null when it does not parse. */
function siteHost(fallback: string): string | null {
  try {
    return new URL(fallback).host.toLowerCase()
  } catch {
    return null
  }
}

/**
 * Origin (scheme + host[:port], no trailing slash) to build absolute
 * redirects from. Trusts `x-forwarded-*` over `host`, but only when the
 * resulting host is allow-listed; otherwise returns `fallback`.
 */
export function requestOrigin(
  headers: Headers,
  fallback: string,
  {
    allowPrivateHosts = process.env.NODE_ENV !== 'production',
  }: RequestOriginOptions = {},
): string {
  const rawHost =
    firstValue(headers.get('x-forwarded-host')) ??
    firstValue(headers.get('host'))
  if (!rawHost) return fallback

  const { hostname, port } = splitHost(rawHost.toLowerCase())
  // A bind-all address is never reachable from a browser; localhost is the
  // only sensible host it can map to.
  const normalisedHostname = BIND_ALL_HOSTNAMES.has(hostname)
    ? 'localhost'
    : hostname
  const host = `${normalisedHostname}${port}`

  const isSiteHost = host === siteHost(fallback)
  const isPrivate = allowPrivateHosts && isPrivateHostname(normalisedHostname)
  if (!isSiteHost && !isPrivate) return fallback

  const forwardedProto = firstValue(
    headers.get('x-forwarded-proto'),
  )?.toLowerCase()
  const proto =
    forwardedProto === 'http' || forwardedProto === 'https'
      ? forwardedProto
      : isPrivateHostname(normalisedHostname)
        ? 'http'
        : 'https'

  return `${proto}://${host}`
}
