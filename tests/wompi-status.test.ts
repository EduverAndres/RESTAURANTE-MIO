import { describe, expect, it } from 'vitest'
import {
  buildCheckoutUrl,
  mapWompiStatus,
  orderIdFromReference,
  paymentReference,
  wompiBaseUrl,
} from '@/lib/payments/wompi/status'

describe('mapWompiStatus', () => {
  it('maps APPROVED to paid, without cancelling the order', () => {
    expect(mapWompiStatus('APPROVED')).toEqual({
      paymentStatus: 'paid',
      cancelOrder: false,
    })
  })

  it('maps DECLINED and ERROR to failed and cancels the order', () => {
    expect(mapWompiStatus('DECLINED')).toEqual({
      paymentStatus: 'failed',
      cancelOrder: true,
    })
    expect(mapWompiStatus('ERROR')).toEqual({
      paymentStatus: 'failed',
      cancelOrder: true,
    })
  })

  it('maps VOIDED to refunded, without cancelling the order', () => {
    expect(mapWompiStatus('VOIDED')).toEqual({
      paymentStatus: 'refunded',
      cancelOrder: false,
    })
  })

  it('maps PENDING to pending, without cancelling the order', () => {
    expect(mapWompiStatus('PENDING')).toEqual({
      paymentStatus: 'pending',
      cancelOrder: false,
    })
  })

  it('falls back to pending for an unknown status', () => {
    expect(mapWompiStatus('SOMETHING_NEW')).toEqual({
      paymentStatus: 'pending',
      cancelOrder: false,
    })
  })
})

describe('wompiBaseUrl', () => {
  it('picks the sandbox host for test keys', () => {
    expect(wompiBaseUrl('pub_test_abc')).toBe('https://sandbox.wompi.co/v1')
  })

  it('picks the production host for prod keys', () => {
    expect(wompiBaseUrl('pub_prod_abc')).toBe(
      'https://production.wompi.co/v1',
    )
  })
})

describe('buildCheckoutUrl', () => {
  it('builds the Web Checkout URL with URLSearchParams, keeping colon keys literal', () => {
    const url = buildCheckoutUrl({
      publicKey: 'pub_test_abc',
      currency: 'COP',
      amountInCents: 4900000,
      reference: 'ord_1',
      signature: 'deadbeef',
      redirectUrl: 'https://tienda.app/orders/1',
      customerEmail: 'ana@example.com',
      customerFullName: 'Ana Pérez',
    })
    const parsed = new URL(url)
    expect(parsed.origin + parsed.pathname).toBe(
      'https://checkout.wompi.co/p/',
    )
    expect(parsed.searchParams.get('public-key')).toBe('pub_test_abc')
    expect(parsed.searchParams.get('currency')).toBe('COP')
    expect(parsed.searchParams.get('amount-in-cents')).toBe('4900000')
    expect(parsed.searchParams.get('reference')).toBe('ord_1')
    expect(parsed.searchParams.get('signature:integrity')).toBe('deadbeef')
    expect(parsed.searchParams.get('redirect-url')).toBe(
      'https://tienda.app/orders/1',
    )
    expect(parsed.searchParams.get('customer-data:email')).toBe(
      'ana@example.com',
    )
    expect(parsed.searchParams.get('customer-data:full-name')).toBe(
      'Ana Pérez',
    )
  })

  it('omits optional customer data when not provided', () => {
    const url = buildCheckoutUrl({
      publicKey: 'pub_test_abc',
      currency: 'COP',
      amountInCents: 100,
      reference: 'ord_1',
      signature: 'deadbeef',
      redirectUrl: 'https://tienda.app/orders/1',
    })
    const parsed = new URL(url)
    expect(parsed.searchParams.has('customer-data:email')).toBe(false)
    expect(parsed.searchParams.has('customer-data:full-name')).toBe(false)
  })
})

describe('paymentReference / orderIdFromReference', () => {
  it('round-trips an order id through the reference', () => {
    const orderId = '11111111-1111-4111-8111-111111111111'
    const reference = paymentReference(orderId)
    expect(reference).toBe(`ord_${orderId}`)
    expect(orderIdFromReference(reference)).toBe(orderId)
  })

  it('returns null for a reference that is not one of ours', () => {
    expect(orderIdFromReference('mock_ABC')).toBeNull()
  })
})
