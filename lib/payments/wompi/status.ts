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

const DOTTED_IPV4 = /(^|[^0-9])\d{1,3}(\.\d{1,3}){3}([^0-9]|$)/

/**
 * Whether Wompi's checkout will open with this return address.
 *
 * checkout.wompi.co sits behind an AWS firewall that answers a bare
 * CloudFront "403 Request blocked" page, before Wompi even reads the order,
 * when a parameter carries a URL with an IP address in it (its rule against
 * remote file inclusion) or one on localhost. A shop published as
 * `http://44.213.146.211` therefore could not take a single card payment.
 * Probed against the live checkout: `ejemplo.com` and
 * `44-213-146-211.sslip.io` open; `44.213.146.211`, `44.213.146.211.nip.io`
 * and `localhost:3000` are blocked.
 */
export function wompiAcceptsRedirect(url: string): boolean {
  let host: string
  try {
    host = new URL(url).hostname.toLowerCase()
  } catch {
    return false
  }
  if (host === 'localhost' || host.endsWith('.localhost')) return false
  // An IPv6 literal (`[::1]`) is an address too.
  if (host.startsWith('[')) return false
  return !DOTTED_IPV4.test(host)
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
  if (input.customerEmail)
    params.set('customer-data:email', input.customerEmail)
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
