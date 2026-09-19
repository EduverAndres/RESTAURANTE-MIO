import { describe, expect, it } from 'vitest'
import { REDACTED, redactContext, redactValue } from '@/lib/log/redact'

describe('redactContext', () => {
  it('strips a QR table token by key, however it is spelled', () => {
    expect(
      redactContext({
        token: 'qr-secret',
        qr_token: 'qr-secret',
        tableToken: 'qr-secret',
        'x-table-token': 'qr-secret',
      }),
    ).toEqual({
      token: REDACTED,
      qr_token: REDACTED,
      tableToken: REDACTED,
      'x-table-token': REDACTED,
    })
  })

  it('strips secrets, keys, passwords, cookies and authorization headers', () => {
    expect(
      redactContext({
        WOMPI_EVENTS_SECRET: 'events',
        supabaseKey: 'sb_secret_abc',
        password: 'hunter2',
        cookie: 'tienda_guest_orders=abc',
        authorization: 'Bearer abc.def',
        credentials: 'x',
      }),
    ).toEqual({
      WOMPI_EVENTS_SECRET: REDACTED,
      supabaseKey: REDACTED,
      password: REDACTED,
      cookie: REDACTED,
      authorization: REDACTED,
      credentials: REDACTED,
    })
  })

  it('strips signature material so a checksum is never replayable from a log', () => {
    expect(redactContext({ checksum: 'ABC', signature: { checksum: 'ABC' } })).toEqual({
      checksum: REDACTED,
      signature: REDACTED,
    })
  })

  it('strips the guest-order cookie value even under an innocent key', () => {
    expect(redactContext({ header: 'tienda_guest_orders=11111111-1111-4111-8111-111111111111' }))
      .toEqual({ header: REDACTED })
  })

  it('strips a Supabase key, a JWT and a Wompi key found inside a string', () => {
    expect(
      redactContext({
        message: 'failed with sb_secret_2wLkQ9zXabc',
        jwt: undefined,
        detail: 'token eyJhbGciOiJIUzI1NiJ9.eyJyb2xlIjoiYW5vbiJ9.Zm9vYmFy expired',
        provider: 'key prv_test_9aB3cD said no',
      }),
    ).toEqual({
      message: `failed with ${REDACTED}`,
      jwt: undefined,
      detail: `token ${REDACTED} expired`,
      provider: `key ${REDACTED} said no`,
    })
  })

  it('strips anything shaped like a full card number', () => {
    expect(redactContext({ note: 'paid with 4242 4242 4242 4242 today' })).toEqual({
      note: `paid with ${REDACTED} today`,
    })
  })

  it('keeps the ordinary operational context a log is written for', () => {
    const context = {
      orderId: '11111111-1111-4111-8111-111111111111',
      expectedCents: 4900000,
      receivedCents: 4900001,
      outcome: 'amount_mismatch',
      reopened: false,
      missing: null,
    }
    expect(redactContext(context)).toEqual(context)
  })

  it('walks nested objects and arrays', () => {
    expect(
      redactValue({ a: [{ token: 't' }, { orderId: 'o' }], b: { c: { secret: 's' } } }),
    ).toEqual({ a: [{ token: REDACTED }, { orderId: 'o' }], b: { c: { secret: REDACTED } } })
  })

  it('does not recurse forever on a cyclic object', () => {
    const cyclic: Record<string, unknown> = { orderId: 'o' }
    cyclic.self = cyclic
    expect(() => redactContext(cyclic)).not.toThrow()
  })

  it('renders values a JSON line cannot carry', () => {
    expect(redactValue(new Date('2026-09-19T08:00:00.000Z'))).toBe(
      '2026-09-19T08:00:00.000Z',
    )
    expect(redactValue(BigInt(10))).toBe('10')
    expect(redactValue(() => undefined)).toBe('[function]')
  })
})
