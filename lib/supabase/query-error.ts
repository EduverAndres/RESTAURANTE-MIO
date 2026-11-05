// A failed read on a working screen used to fall through to `data ?? []`:
// the merchant's order board said "no orders", the admin saw "no stores".
// An empty list and a broken query must never look the same, so the panels
// throw instead and their `error.tsx` offers a retry. Pure: no imports.

/** Throws when a query failed; `what` names the read for the server log. */
export function throwOnQueryError(error: unknown, what: string): void {
  if (error) throw new Error(`Query failed: ${what}`, { cause: error })
}
