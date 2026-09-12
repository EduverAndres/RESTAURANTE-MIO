/**
 * The contract between the theme editor and the live preview iframe.
 *
 * Two channels, because a storefront is two different things at once:
 *
 * 1. **Skin** — colours, fonts, radius, density, shadows, motion. All of it is
 *    a `--store-*` custom property, so the editor `postMessage`s the whole
 *    theme and the preview bridge writes the variables straight onto the
 *    wrapper. No network, no reload: typing a hex code moves the preview.
 * 2. **Structure** — which sections render, the menu layout, the hero variant,
 *    the copy. Those are server components, so the preview has to re-render.
 *    The editor drops the theme into a cookie and the bridge asks Next.js to
 *    refresh the tree, which patches the DOM without reloading the frame.
 *
 * `structureSignature` is what tells the two apart: when it does not move,
 * the cookie and the refresh are skipped entirely.
 *
 * Everything here is pure so both ends and the tests agree on one definition.
 */

import type { StoreTheme } from '@/types/app'

export const PREVIEW_MESSAGE_TYPE = 'tienda:theme-preview'
/** Sent by the preview once it is listening, so the editor can push at once. */
export const PREVIEW_READY_TYPE = 'tienda:theme-preview-ready'

/** Read by the preview route on the server; never read by the storefront. */
export const PREVIEW_COOKIE = 'store_preview_theme'

/**
 * One cookie per store, so a merchant editing two shops in two tabs cannot
 * have one preview pick up the other's draft. Non-hex characters are dropped
 * because a cookie name has to stay a token.
 */
export function previewCookieName(storeId: string): string {
  const suffix = String(storeId)
    .replace(/[^a-zA-Z0-9]/g, '')
    .slice(0, 12)
  return suffix ? `${PREVIEW_COOKIE}_${suffix}` : PREVIEW_COOKIE
}

/**
 * Browsers guarantee 4096 bytes per cookie. Staying under 3800 leaves room for
 * the attributes and keeps one oversized theme from silently breaking the
 * preview instead of just skipping the structural refresh.
 */
export const PREVIEW_THEME_MAX_COOKIE_BYTES = 3800

export interface PreviewMessage {
  type: typeof PREVIEW_MESSAGE_TYPE
  theme: StoreTheme
  /** Device-level override of `theme.mode`, driven by the preview toolbar. */
  scheme: 'light' | 'dark' | 'auto'
}

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === 'object' && value !== null && !Array.isArray(value)
}

export function isPreviewMessage(value: unknown): value is PreviewMessage {
  return (
    isRecord(value) &&
    value.type === PREVIEW_MESSAGE_TYPE &&
    isRecord(value.theme)
  )
}

// ---------------------------------------------------------------------------
// Cookie transport
// ---------------------------------------------------------------------------

function toBase64Url(text: string): string {
  const bytes = new TextEncoder().encode(text)
  let binary = ''
  for (const byte of bytes) binary += String.fromCharCode(byte)
  return btoa(binary).replace(/\+/g, '-').replace(/\//g, '_').replace(/=+$/, '')
}

function fromBase64Url(value: string): string {
  const padded = value.replace(/-/g, '+').replace(/_/g, '/')
  const binary = atob(padded)
  const bytes = new Uint8Array(binary.length)
  for (let index = 0; index < binary.length; index += 1) {
    bytes[index] = binary.charCodeAt(index)
  }
  return new TextDecoder().decode(bytes)
}

/**
 * Base64url of the theme, ready to be a cookie value. Custom CSS is left out
 * on purpose: it is worth up to 4 KB on its own and the bridge can inject it
 * client-side anyway. Returns null when the result would not fit in a cookie.
 */
export function encodePreviewTheme(theme: StoreTheme): string | null {
  let encoded: string
  try {
    encoded = toBase64Url(JSON.stringify({ ...theme, customCss: null }))
  } catch {
    return null
  }
  const size = `${PREVIEW_COOKIE}=${encoded}`.length
  return size < PREVIEW_THEME_MAX_COOKIE_BYTES ? encoded : null
}

/**
 * The object a preview cookie carries, or null when the value is absent or
 * damaged. The caller still has to run it through `normalizeTheme`: this only
 * promises valid JSON, never a valid theme.
 */
export function decodePreviewTheme(value: string | undefined | null): unknown {
  if (typeof value !== 'string' || value.length === 0) return null
  try {
    const parsed: unknown = JSON.parse(fromBase64Url(value))
    return isRecord(parsed) ? parsed : null
  } catch {
    return null
  }
}

// ---------------------------------------------------------------------------
// Structure signature
// ---------------------------------------------------------------------------

/**
 * A digest of everything the server decides. Two themes with the same
 * signature render the same DOM and differ only in CSS variables, which is
 * exactly when the preview can skip the refresh.
 *
 * Deliberately excluded: every colour, the fonts, `radius`, `buttonStyle`,
 * `density`, `cardStyle`, `imageRatio`, `imageShape`, `pattern`, `motion`,
 * `gradient`, `banner.overlayOpacity` and `customCss` — all of them reach the
 * page as `--store-*` values or as an injected stylesheet.
 */
export function structureSignature(theme: StoreTheme): string {
  return JSON.stringify([
    theme.mode,
    theme.logoUrl,
    theme.sectionOrder,
    theme.menuLayout,
    theme.categoryNav,
    theme.productHover,
    theme.showPrices,
    theme.badges.newDays,
    theme.badges.popularEnabled,
    theme.badges.style,
    theme.banner.layout,
    theme.banner.imageUrl,
    theme.hero,
    theme.featured,
    theme.story,
    theme.social,
    theme.footer,
  ])
}
