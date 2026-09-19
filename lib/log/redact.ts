// Redaction for structured logs. Pure: give it a value, get back a value
// that is safe to serialise into a log line and safe to ship to a third
// party (Sentry).
//
// Two independent defences, because either one alone leaks:
//
//   1. Key names. Anything whose key looks like a credential is replaced
//      wholesale, however deeply nested. This is what stops a QR table token
//      or a Supabase secret from being logged on purpose.
//   2. Value shapes. Secrets also arrive *inside* otherwise innocent strings
//      — a driver error that quotes the key it rejected, a header dump, an
//      exception message. The patterns below strip the ones this app handles:
//      Supabase keys, JWTs, Wompi keys, the guest-order cookie and anything
//      shaped like a full card number.
//
// The rule when in doubt is to redact: a log line that is missing a detail
// costs one more deploy, a log line carrying a service-role key costs the
// whole database.

export const REDACTED = '[redacted]'

/** Beyond this the value is summarised; logs are not a heap dump. */
const MAX_DEPTH = 6
const MAX_ARRAY_ITEMS = 50
const MAX_STRING_LENGTH = 2000

// Matched against the key with everything but letters and digits removed and
// lower-cased, so `qr_token`, `x-table-token` and `tableToken` all hit
// `token`.
const SENSITIVE_KEY_PARTS = [
  'token',
  'secret',
  'password',
  'passwd',
  'key',
  'auth',
  'cookie',
  'credential',
  'bearer',
  'session',
  'signature',
  'checksum',
  'card',
  'cvc',
  'cvv',
] as const

const SENSITIVE_VALUE_PATTERNS: readonly RegExp[] = [
  // Guest-order cookie, name and value: it authorises reading someone's
  // orders without a login.
  /tienda_guest_orders=[^;\s]*/g,
  // Supabase publishable/secret keys.
  /\bsb_(?:secret|publishable)_[A-Za-z0-9_-]+/g,
  // Any JWT, which covers the legacy anon and service-role keys.
  /\beyJ[A-Za-z0-9_-]{4,}\.[A-Za-z0-9_-]{4,}\.[A-Za-z0-9_-]+/g,
  // Wompi public/private keys.
  /\b(?:prv|pub)_[A-Za-z0-9]+_[A-Za-z0-9]+/g,
  // A bare 13-19 digit run, i.e. a card number. The lookarounds keep it off
  // UUIDs and other dash-separated digit groups, whose runs are shorter and
  // always adjacent to a dash.
  /(?<![\d-])\d{13,19}(?![\d-])/g,
  // The same, written in groups of four.
  /(?<![\d-])\d{4}[ -]\d{4}[ -]\d{4}[ -]\d{1,4}(?![\d-])/g,
]

function isSensitiveKey(key: string): boolean {
  const normalised = key.toLowerCase().replace(/[^a-z0-9]/g, '')
  return SENSITIVE_KEY_PARTS.some((part) => normalised.includes(part))
}

/** Strips secret-shaped substrings and caps the length. */
export function redactString(value: string): string {
  let result = value
  for (const pattern of SENSITIVE_VALUE_PATTERNS) {
    result = result.replace(pattern, REDACTED)
  }
  return result.length > MAX_STRING_LENGTH
    ? `${result.slice(0, MAX_STRING_LENGTH)}…`
    : result
}

function redactUnknown(
  value: unknown,
  depth: number,
  seen: WeakSet<object>,
): unknown {
  if (value === null || value === undefined) return value
  if (typeof value === 'string') return redactString(value)
  if (typeof value === 'number' || typeof value === 'boolean') return value
  if (typeof value === 'bigint') return value.toString()
  if (typeof value === 'function') return '[function]'
  if (typeof value === 'symbol') return value.toString()
  if (value instanceof Date) return value.toISOString()
  if (value instanceof Error) {
    return { name: value.name, message: redactString(value.message) }
  }
  if (depth >= MAX_DEPTH) return '[truncated]'

  const object = value as object
  if (seen.has(object)) return '[circular]'
  seen.add(object)

  if (Array.isArray(value)) {
    const items = value
      .slice(0, MAX_ARRAY_ITEMS)
      .map((item) => redactUnknown(item, depth + 1, seen))
    return value.length > MAX_ARRAY_ITEMS
      ? [...items, `[+${value.length - MAX_ARRAY_ITEMS} more]`]
      : items
  }

  const result: Record<string, unknown> = {}
  for (const [key, item] of Object.entries(value as Record<string, unknown>)) {
    result[key] = isSensitiveKey(key)
      ? REDACTED
      : redactUnknown(item, depth + 1, seen)
  }
  return result
}

/** Redacts any value: strings, nested objects, arrays, cyclic graphs. */
export function redactValue(value: unknown): unknown {
  return redactUnknown(value, 0, new WeakSet())
}

/** Redacts a log context, which is always a plain object of details. */
export function redactContext(
  context: Record<string, unknown>,
): Record<string, unknown> {
  return redactUnknown(context, 0, new WeakSet()) as Record<string, unknown>
}
