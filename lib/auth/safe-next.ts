// Validates a "next" redirect target coming from the URL so the auth flow
// can never bounce a user to another origin. Pure: no server imports.

const AUTH_PREFIXES = ['/login', '/register', '/forgot-password', '/auth/']

/**
 * Returns the path when it is a same-origin relative path outside the auth
 * pages, otherwise null so callers fall back to a default destination.
 */
export function safeNextPath(value: string | null | undefined): string | null {
  if (typeof value !== 'string' || value.length === 0) return null
  if (!value.startsWith('/')) return null
  // "//host" and "/\host" are treated as protocol-relative by browsers.
  if (value.startsWith('//') || value.startsWith('/\\')) return null
  if (/[\r\n\0]/.test(value)) return null
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
