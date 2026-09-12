// A one-shot handoff between the checkout and the tracking page.
//
// The confirmation animation belongs on the tracking page — that is where the
// order number lives — but "this order was just placed" is knowledge only the
// checkout has. A query parameter would survive a refresh, a share and a
// bookmark, and would replay the celebration every time; session storage is
// read once and cleared.

const KEY = 'checkout:just-placed'

export function markOrderJustPlaced(orderId: string): void {
  try {
    window.sessionStorage.setItem(KEY, orderId)
  } catch {
    // Private mode, or storage disabled. The tracking page simply does not
    // celebrate; nothing about the order depends on it.
  }
}

/** True at most once per placed order; reading it clears the flag. */
export function consumeOrderJustPlaced(orderId: string): boolean {
  try {
    const stored = window.sessionStorage.getItem(KEY)
    if (stored !== orderId) return false
    window.sessionStorage.removeItem(KEY)
    return true
  } catch {
    return false
  }
}
