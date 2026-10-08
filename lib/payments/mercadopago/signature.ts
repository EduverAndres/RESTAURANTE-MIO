import { createHmac, timingSafeEqual } from 'node:crypto'

/**
 * Mercado Pago webhook signature check.
 *
 * Mercado Pago does not sign the body. It sends
 *   x-signature:  ts=<unix seconds>,v1=<hex hmac>
 *   x-request-id: <uuid>
 * and `v1` is HMAC-SHA256, keyed with the webhook secret, over the manifest
 *   id:<data.id>;request-id:<x-request-id>;ts:<ts>;
 * where `data.id` comes from the notification URL's query string (lower-cased
 * when alphanumeric). Parts that are absent are left out of the manifest.
 */
export function parseSignatureHeader(
  header: string | null,
): { ts: string; v1: string } | null {
  if (!header) return null
  const parts = new Map(
    header.split(',').map((part) => {
      const [key, ...rest] = part.trim().split('=')
      return [key, rest.join('=')] as const
    }),
  )
  const ts = parts.get('ts')
  const v1 = parts.get('v1')
  return ts && v1 ? { ts, v1 } : null
}

export function signatureManifest({
  dataId,
  requestId,
  ts,
}: {
  dataId: string | null
  requestId: string | null
  ts: string
}): string {
  const id =
    dataId && /^[a-z0-9]+$/i.test(dataId) ? dataId.toLowerCase() : dataId
  return [
    id ? `id:${id};` : '',
    requestId ? `request-id:${requestId};` : '',
    `ts:${ts};`,
  ].join('')
}

export function verifyMercadoPagoSignature({
  secret,
  signatureHeader,
  requestId,
  dataId,
}: {
  secret: string
  signatureHeader: string | null
  requestId: string | null
  dataId: string | null
}): boolean {
  const parsed = parseSignatureHeader(signatureHeader)
  if (!parsed) return false
  const expected = createHmac('sha256', secret)
    .update(signatureManifest({ dataId, requestId, ts: parsed.ts }))
    .digest('hex')
  const given = Buffer.from(parsed.v1, 'utf8')
  const wanted = Buffer.from(expected, 'utf8')
  return given.length === wanted.length && timingSafeEqual(given, wanted)
}
