// Pure helpers for the httpOnly cookie that lets an anonymous table guest
// open the orders they placed from a QR code. The server action writes it,
// the tracking page reads it; nothing here touches Next.js APIs.

export const GUEST_ORDERS_COOKIE = 'tienda_guest_orders'
export const GUEST_ORDERS_MAX = 10
export const GUEST_ORDERS_MAX_AGE_SECONDS = 24 * 60 * 60

const UUID_PATTERN =
  /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i

function isUuidString(value: unknown): value is string {
  return typeof value === 'string' && UUID_PATTERN.test(value)
}

/** Order ids stored in the cookie, newest first. Garbage yields an empty list. */
export function parseGuestOrders(raw: string | undefined): string[] {
  if (!raw) return []
  try {
    const parsed: unknown = JSON.parse(raw)
    if (!Array.isArray(parsed)) return []
    return parsed.filter(isUuidString).slice(0, GUEST_ORDERS_MAX)
  } catch {
    return []
  }
}

/** Puts the id first (moving it when already present) and caps the list. */
export function addGuestOrder(ids: readonly string[], id: string): string[] {
  return [id, ...ids.filter((existing) => existing !== id)].slice(
    0,
    GUEST_ORDERS_MAX,
  )
}

export function serializeGuestOrders(ids: readonly string[]): string {
  return JSON.stringify(ids.slice(0, GUEST_ORDERS_MAX))
}

export function hasGuestOrder(raw: string | undefined, id: string): boolean {
  return parseGuestOrders(raw).includes(id)
}
