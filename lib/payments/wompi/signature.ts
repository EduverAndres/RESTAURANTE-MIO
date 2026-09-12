import { createHash, timingSafeEqual } from 'node:crypto'

// Pure signature helpers for Wompi's Web Checkout integrity hash and the
// events webhook checksum. No network, no env access, so they are testable
// with plain objects. See docs.wompi.co for the exact concatenation rules.

export interface IntegritySignatureInput {
  reference: string
  amountInCents: number
  currency: string
  expirationTime?: string
  secret: string
}

/** `sha256(reference + amountInCents + currency [+ expirationTime] + secret)`. */
export function integritySignature(input: IntegritySignatureInput): string {
  const parts = [
    input.reference,
    String(input.amountInCents),
    input.currency,
    input.expirationTime ?? '',
    input.secret,
  ]
  return createHash('sha256').update(parts.join('')).digest('hex')
}

/** Reads a dotted path (e.g. `transaction.id`) out of an arbitrary object. */
function resolvePath(data: unknown, path: string): string {
  const value = path
    .split('.')
    .reduce<unknown>(
      (current, key) =>
        current && typeof current === 'object'
          ? (current as Record<string, unknown>)[key]
          : undefined,
      data,
    )
  return value === undefined || value === null ? '' : String(value)
}

export interface EventChecksumInputParams {
  properties: readonly string[]
  data: unknown
  timestamp: number
}

/** Concatenation of the resolved property values followed by the timestamp. */
export function eventChecksumInput(params: EventChecksumInputParams): string {
  const values = params.properties.map((path) => resolvePath(params.data, path))
  return [...values, String(params.timestamp)].join('')
}

export interface EventChecksumParams extends EventChecksumInputParams {
  secret: string
}

/** `sha256(concat(properties) + timestamp + secret)` as uppercase hex. */
export function eventChecksum(params: EventChecksumParams): string {
  const input = eventChecksumInput(params) + params.secret
  return createHash('sha256').update(input).digest('hex').toUpperCase()
}

export interface WompiEvent {
  event: string
  data: unknown
  environment: string
  signature: { properties: string[]; checksum: string }
  timestamp: number
  sent_at?: string
}

/** Timing-safe checksum comparison; never throws on a length mismatch. */
export function verifyEventChecksum(
  event: WompiEvent,
  secret: string,
): boolean {
  const expected = eventChecksum({
    properties: event.signature.properties,
    data: event.data,
    timestamp: event.timestamp,
    secret,
  })
  const received = Buffer.from(event.signature.checksum ?? '', 'utf8')
  const expectedBuffer = Buffer.from(expected, 'utf8')
  if (received.length !== expectedBuffer.length) return false
  return timingSafeEqual(received, expectedBuffer)
}
