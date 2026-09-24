// Pure platform checks for the push toggle's guidance copy.

/**
 * iOS only delivers Web Push to a PWA that was added to the home screen, and
 * every iOS browser is WebKit underneath, so the user agent alone decides
 * the platform. `standalone` is the caller's reading of
 * `navigator.standalone` / `(display-mode: standalone)`.
 */
export function needsHomeScreenInstall(
  ua: string,
  standalone: boolean,
): boolean {
  if (standalone) return false
  return /\b(iphone|ipad)\b/i.test(ua)
}
