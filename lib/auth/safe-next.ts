// Validates a "next" redirect target coming from the URL so the auth flow
// can never bounce a user to another origin. Pure: no server imports.

const AUTH_PREFIXES = ['/login', '/register', '/forgot-password', '/auth/']

// Never a real host: only used to see where a browser would resolve `next`.
const SENTINEL_ORIGIN = 'http://next.invalid'

/**
 * Returns the path when it is a same-origin relative path outside the auth
 * pages, otherwise null so callers fall back to a default destination.
 */
export function safeNextPath(value: string | null | undefined): string | null {
  if (typeof value !== 'string' || value.length === 0) return null
  if (!value.startsWith('/')) return null
  // Control characters and backslashes are never part of a path we issue,
  // and browsers silently drop or rewrite them: "/<TAB>/evil.com" resolves
  // to https://evil.com because the URL parser strips the tab.
  if (/[\u0000-\u001F\u007F\\]/.test(value)) return null
  // Resolve it the way a browser will and keep it only if it stays on our
  // origin; this catches every protocol-relative trick ("//host", ...) at once.
  let url: URL
  try {
    url = new URL(value, SENTINEL_ORIGIN)
  } catch {
    return null
  }
  if (url.origin !== SENTINEL_ORIGIN) return null
  value = `${url.pathname}${url.search}${url.hash}`
  if (
    AUTH_PREFIXES.some(
      (prefix) =>
        value === prefix.replace(/\/$/, '') ||
        value.startsWith(prefix) ||
        value.startsWith(`${prefix}?`),
    )
  ) {
    return null
  }
  return value
}
