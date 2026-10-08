import { createHmac } from 'node:crypto'
import { describe, expect, it } from 'vitest'
import {
  parseSignatureHeader,
  signatureManifest,
  verifyMercadoPagoSignature,
} from '@/lib/payments/mercadopago/signature'

const SECRET = 'secreto-de-prueba'

function sign(manifest: string): string {
  return createHmac('sha256', SECRET).update(manifest).digest('hex')
}

describe('Mercado Pago webhook signature', () => {
  it('parses ts and v1 out of the header', () => {
    expect(parseSignatureHeader('ts=1704908010,v1=abc123')).toEqual({
      ts: '1704908010',
      v1: 'abc123',
    })
    expect(parseSignatureHeader('v1=abc')).toBeNull()
    expect(parseSignatureHeader(null)).toBeNull()
  })

  it('builds the documented manifest, lower-casing alphanumeric ids', () => {
    expect(
      signatureManifest({ dataId: 'ABC123', requestId: 'req-1', ts: '42' }),
    ).toBe('id:abc123;request-id:req-1;ts:42;')
    expect(signatureManifest({ dataId: null, requestId: null, ts: '42' })).toBe(
      'ts:42;',
    )
  })

  it('accepts a genuine notification and rejects a forged one', () => {
    const v1 = sign('id:123456;request-id:req-9;ts:1704908010;')
    const base = {
      secret: SECRET,
      signatureHeader: `ts=1704908010,v1=${v1}`,
      requestId: 'req-9',
      dataId: '123456',
    }
    expect(verifyMercadoPagoSignature(base)).toBe(true)
    expect(verifyMercadoPagoSignature({ ...base, dataId: '999999' })).toBe(
      false,
    )
    expect(
      verifyMercadoPagoSignature({ ...base, signatureHeader: 'ts=1,v1=00' }),
    ).toBe(false)
    expect(verifyMercadoPagoSignature({ ...base, signatureHeader: null })).toBe(
      false,
    )
  })
})
