import { createHash } from 'node:crypto'
import { describe, expect, it } from 'vitest'
import {
  eventChecksum,
  eventChecksumInput,
  integritySignature,
  verifyEventChecksum,
  type WompiEvent,
} from '@/lib/payments/wompi/signature'

function sha256(value: string): string {
  return createHash('sha256').update(value).digest('hex')
}

describe('integritySignature', () => {
  it('hashes reference + amount + currency + secret as lowercase hex', () => {
    const expected = sha256('ord_abc4900000COPintegrity_secret')
    const signature = integritySignature({
      reference: 'ord_abc',
      amountInCents: 4900000,
      currency: 'COP',
      secret: 'integrity_secret',
    })
    expect(signature).toBe(expected)
    expect(signature).toBe(expected.toLowerCase())
  })

  it('includes the expiration time when provided, before the secret', () => {
    const expected = sha256(
      'ord_abc4900000COP2026-09-12T00:00:00.000Zintegrity_secret',
    )
    const signature = integritySignature({
      reference: 'ord_abc',
      amountInCents: 4900000,
      currency: 'COP',
      expirationTime: '2026-09-12T00:00:00.000Z',
      secret: 'integrity_secret',
    })
    expect(signature).toBe(expected)
  })
})

describe('eventChecksumInput', () => {
  it('produces the doc-example concatenation string from dotted properties', () => {
    const data = {
      transaction: {
        id: '1234-1610641025-49201',
        status: 'APPROVED',
        amount_in_cents: 4490000,
      },
    }
    const input = eventChecksumInput({
      properties: [
        'transaction.id',
        'transaction.status',
        'transaction.amount_in_cents',
      ],
      data,
      timestamp: 1610641026,
    })
    expect(input).toBe('1234-1610641025-49201APPROVED44900001610641026')
  })
})

describe('eventChecksum', () => {
  it('hashes the concatenation input + secret as uppercase hex', () => {
    const data = {
      transaction: {
        id: '1234-1610641025-49201',
        status: 'APPROVED',
        amount_in_cents: 4490000,
      },
    }
    const properties = [
      'transaction.id',
      'transaction.status',
      'transaction.amount_in_cents',
    ]
    const timestamp = 1610641026
    const secret = 'events_secret'
    const expected = sha256(
      eventChecksumInput({ properties, data, timestamp }) + secret,
    ).toUpperCase()
    const checksum = eventChecksum({ properties, data, timestamp, secret })
    expect(checksum).toBe(expected)
    expect(checksum).toBe(checksum.toUpperCase())
  })
})

describe('verifyEventChecksum', () => {
  function buildEvent(overrides: Partial<WompiEvent> = {}): WompiEvent {
    return {
      event: 'transaction.updated',
      data: {
        transaction: {
          id: 'tx_1',
          status: 'APPROVED',
          amount_in_cents: 100000,
          reference: 'ord_1',
        },
      },
      environment: 'test',
      signature: {
        properties: ['transaction.id', 'transaction.status'],
        checksum: '',
      },
      timestamp: 1700000000,
      sent_at: '2026-09-12T00:00:00.000Z',
      ...overrides,
    }
  }

  it('accepts a checksum computed with the same secret', () => {
    const secret = 'events_secret'
    const base = buildEvent()
    const checksum = eventChecksum({
      properties: base.signature.properties,
      data: base.data,
      timestamp: base.timestamp,
      secret,
    })
    const event = buildEvent({
      signature: { ...base.signature, checksum },
    })
    expect(verifyEventChecksum(event, secret)).toBe(true)
  })

  it('rejects a checksum computed with a different secret', () => {
    const base = buildEvent()
    const checksum = eventChecksum({
      properties: base.signature.properties,
      data: base.data,
      timestamp: base.timestamp,
      secret: 'events_secret',
    })
    const event = buildEvent({ signature: { ...base.signature, checksum } })
    expect(verifyEventChecksum(event, 'other_secret')).toBe(false)
  })

  it('rejects checksums of a different length without throwing', () => {
    const event = buildEvent({
      signature: { properties: ['transaction.id'], checksum: 'short' },
    })
    expect(verifyEventChecksum(event, 'events_secret')).toBe(false)
  })
})
