// Pure helpers for the table QR flow: public paths, token validation and
// table-number arithmetic for the merchant's table manager. Safe to import
// from client components, server code and tests.

/** Tokens come from `encode(gen_random_bytes(12), 'hex')`: 24 lowercase hex. */
const TOKEN_PATTERN = /^[0-9a-f]{24}$/

/** Upper bound for a single bulk creation so a typo cannot spawn thousands. */
export const MAX_TABLES_PER_BATCH = 200
export const MAX_TABLE_NUMBER = 999
/** Hard cap on the tables rendered (one QR each) in the dashboard listing. */
export const MAX_TABLES_PER_STORE = 500

export function isTableToken(value: string): boolean {
  return TOKEN_PATTERN.test(value)
}

export function tableEntryPath(slug: string, token: string): string {
  return `/t/${slug}/mesa/${token}`
}

export function tableCheckoutPath(slug: string, token: string): string {
  return `${tableEntryPath(slug, token)}/checkout`
}

export function tableOrderPath(
  slug: string,
  token: string,
  orderId: string,
): string {
  return `${tableEntryPath(slug, token)}/pedido/${orderId}`
}

export function tableEntryUrl(
  baseUrl: string,
  slug: string,
  token: string,
): string {
  return `${baseUrl.replace(/\/+$/, '')}${tableEntryPath(slug, token)}`
}

function isTableNumber(value: number): boolean {
  return Number.isInteger(value) && value > 0 && value <= MAX_TABLE_NUMBER
}

/** Next free number: one past the highest valid existing number. */
export function nextTableNumber(existing: readonly number[]): number {
  const valid = existing.filter(isTableNumber)
  return valid.length === 0 ? 1 : Math.max(...valid) + 1
}

/**
 * Parses "1-12", "4" or "1,3,5-7" into a sorted, de-duplicated list of
 * table numbers. Returns an empty list for anything invalid or for batches
 * larger than MAX_TABLES_PER_BATCH so callers can show one clear error.
 */
export function parseTableNumbers(input: string): number[] {
  const numbers = new Set<number>()
  const parts = input
    .split(',')
    .map((part) => part.trim())
    .filter((part) => part.length > 0)
  if (parts.length === 0) return []

  for (const part of parts) {
    const match = /^(\d+)(?:-(\d+))?$/.exec(part)
    if (!match) return []
    const start = Number(match[1])
    const end = match[2] === undefined ? start : Number(match[2])
    if (!isTableNumber(start) || !isTableNumber(end)) return []
    const [low, high] = start <= end ? [start, end] : [end, start]
    if (high - low + 1 > MAX_TABLES_PER_BATCH) return []
    for (let number = low; number <= high; number += 1) numbers.add(number)
    if (numbers.size > MAX_TABLES_PER_BATCH) return []
  }
  return [...numbers].sort((a, b) => a - b)
}
