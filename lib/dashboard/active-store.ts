// Pure helpers for the "active store" the merchant dashboard operates on.
// The selection lives in a cookie; server code validates it against the
// stores the owner actually has. Safe to import from client and tests.

export const ACTIVE_STORE_COOKIE = 'tienda_active_store'

const UUID_PATTERN =
  /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i

export function isUuid(value: string): boolean {
  return UUID_PATTERN.test(value)
}

/** Returns the cookie value when it looks like a uuid, null otherwise. */
export function parseActiveStoreId(value: string | undefined): string | null {
  if (!value || !isUuid(value)) return null
  return value
}

/**
 * Chooses the active store: the requested one when it belongs to the owner,
 * otherwise the first store. Null when the list is empty.
 */
export function pickActiveStore<T extends { id: string }>(
  stores: readonly T[],
  requestedId: string | null,
): T | null {
  if (stores.length === 0) return null
  if (requestedId) {
    const match = stores.find((store) => store.id === requestedId)
    if (match) return match
  }
  return stores[0]
}
