// Payment provider contract. Every gateway (Wompi, Mercado Pago, cash, mock)
// implements this so the checkout action stays provider-agnostic.
import type { PaymentMethod, PaymentStatus } from '@/types/app'

export interface CreatePaymentInput {
  orderId: string
  shortCode: string
  /** Integer amount in COP. */
  amount: number
  currency: 'COP'
  customer: { id: string; email: string | null; name: string | null }
  /** Absolute URL the gateway should send the customer back to. */
  returnUrl: string
}

export interface PaymentResult {
  status: PaymentStatus
  /** Gateway reference stored in orders.payment_ref. */
  reference: string
  /** When set, the customer must be redirected to finish the payment. */
  redirectUrl?: string
  message?: string
}

export interface PaymentProvider {
  readonly method: PaymentMethod
  /** Human label shown in the checkout, in Spanish. */
  readonly label: string
  readonly description: string
  /** Whether the provider can be offered in the current environment. */
  isAvailable(): boolean
  createPayment(input: CreatePaymentInput): Promise<PaymentResult>
  /** Re-checks a payment with the gateway; used by return pages and webhooks. */
  verifyPayment(reference: string): Promise<PaymentResult>
}
