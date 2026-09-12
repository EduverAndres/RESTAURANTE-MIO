import type { PaymentStatus } from '@/types/app'

// Pure Wompi helpers: no network, no env access. Status mapping, base URL
// selection and checkout URL construction are all deterministic functions of
// their inputs so they are unit-testable without a gateway.

export interface MappedStatus {
  paymentStatus: PaymentStatus
  /** True when a declined/errored transaction should cancel the order. */
  cancelOrder: boolean
}

/** Maps a Wompi transaction status to our internal payment status. */
export function mapWompiStatus(status: string): MappedStatus {
  switch (status) {
    case 'APPROVED':
      return { paymentStatus: 'paid', cancelOrder: false }
    case 'DECLINED':
    case 'ERROR':
      return { paymentStatus: 'failed', cancelOrder: true }
    case 'VOIDED':
      return { paymentStatus: 'refunded', cancelOrder: false }
    case 'PENDING':
    default:
      return { paymentStatus: 'pending', cancelOrder: false }
  }
}

/** Sandbox for `pub_test_...` keys, production otherwise. */
export function wompiBaseUrl(publicKey: string): string {
  return publicKey.startsWith('pub_test_')
    ? 'https://sandbox.wompi.co/v1'
    : 'https://production.wompi.co/v1'
}

export interface CheckoutUrlInput {
  publicKey: string
  currency: string
  amountInCents: number
  reference: string
  signature: string
  redirectUrl: string
  expirationTime?: string
  customerEmail?: string | null
  customerFullName?: string | null
}

/** Builds the Wompi Web Checkout redirect URL. */
export function buildCheckoutUrl(input: CheckoutUrlInput): string {
  const params = new URLSearchParams()
  params.set('public-key', input.publicKey)
  params.set('currency', input.currency)
  params.set('amount-in-cents', String(input.amountInCents))
  params.set('reference', input.reference)
  params.set('signature:integrity', input.signature)
  params.set('redirect-url', input.redirectUrl)
  if (input.expirationTime) params.set('expiration-time', input.expirationTime)
  if (input.customerEmail) params.set('customer-data:email', input.customerEmail)
  if (input.customerFullName)
    params.set('customer-data:full-name', input.customerFullName)
  return `https://checkout.wompi.co/p/?${params.toString()}`
}

const REFERENCE_PREFIX = 'ord_'

/** The Wompi reference for an order: `ord_<orderId>`. */
export function paymentReference(orderId: string): string {
  return `${REFERENCE_PREFIX}${orderId}`
}

/** Recovers the order id from one of our references, or null otherwise. */
export function orderIdFromReference(reference: string): string | null {
  return reference.startsWith(REFERENCE_PREFIX)
    ? reference.slice(REFERENCE_PREFIX.length)
    : null
}
