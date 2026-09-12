import 'server-only'

import { serverEnv, wompiConfigured } from '@/lib/env.server'
import { integritySignature } from '@/lib/payments/wompi/signature'
import {
  buildCheckoutUrl,
  mapWompiStatus,
  paymentReference,
  wompiBaseUrl,
} from '@/lib/payments/wompi/status'
import type { PaymentProvider, PaymentResult } from '@/lib/payments/types'

export interface WompiTransactionData {
  id: string
  status: string
  reference: string
  amount_in_cents: number
  currency: string
  payment_method_type?: string
  status_message?: string | null
}

interface WompiTransactionResponse {
  data?: WompiTransactionData
}

/** Upper bound for a transaction lookup; a hung gateway must not hang a page. */
export const WOMPI_REQUEST_TIMEOUT_MS = 6000

/** How long a Web Checkout link stays payable after it is created. */
export const CHECKOUT_TTL_MS = 30 * 60 * 1000

/**
 * Raw GET of a transaction by id; used by verifyPayment and reconciliation.
 * Returns null on any failure (non-2xx, network error, timeout) so callers
 * treat "unknown" and "unreachable" the same way. `fetchImpl` is injectable
 * for tests.
 */
export async function fetchWompiTransaction(
  transactionId: string,
  fetchImpl: typeof fetch = fetch,
): Promise<WompiTransactionData | null> {
  const { WOMPI_PUBLIC_KEY: publicKey, WOMPI_PRIVATE_KEY: privateKey } =
    serverEnv
  if (!publicKey || !privateKey) return null

  const controller = new AbortController()
  const timer = setTimeout(() => controller.abort(), WOMPI_REQUEST_TIMEOUT_MS)
  try {
    const response = await fetchImpl(
      `${wompiBaseUrl(publicKey)}/transactions/${transactionId}`,
      {
        headers: { Authorization: `Bearer ${privateKey}` },
        signal: controller.signal,
      },
    )
    if (!response.ok) {
      console.error('Wompi transaction lookup failed', response.status)
      return null
    }
    const body = (await response.json()) as WompiTransactionResponse
    return body.data ?? null
  } catch (error) {
    console.error('Failed to reach Wompi', error)
    return null
  } finally {
    clearTimeout(timer)
  }
}

export const wompiProvider: PaymentProvider = {
  method: 'wompi',
  label: 'Tarjeta, PSE o Nequi',
  description: 'Pago seguro con Wompi',
  isAvailable() {
    return wompiConfigured()
  },
  async createPayment(input): Promise<PaymentResult> {
    const {
      WOMPI_PUBLIC_KEY: publicKey,
      WOMPI_INTEGRITY_SECRET: integritySecret,
    } = serverEnv
    const reference = paymentReference(input.orderId)
    if (!publicKey || !integritySecret) {
      console.error('Wompi createPayment called without configuration')
      return {
        status: 'failed',
        reference,
        message: 'El pago con Wompi no está disponible en este momento.',
      }
    }
    const amountInCents = Math.round(input.amount * 100)
    // The expiration is part of the integrity hash, so it must be the exact
    // same string in both the signature and the checkout URL.
    const expirationTime = new Date(Date.now() + CHECKOUT_TTL_MS).toISOString()
    const signature = integritySignature({
      reference,
      amountInCents,
      currency: input.currency,
      expirationTime,
      secret: integritySecret,
    })
    const redirectUrl = buildCheckoutUrl({
      publicKey,
      currency: input.currency,
      amountInCents,
      reference,
      signature,
      redirectUrl: input.returnUrl,
      expirationTime,
      customerEmail: input.customer.email,
      customerFullName: input.customer.name,
    })
    return { status: 'pending', reference, redirectUrl }
  },
  async verifyPayment(transactionId): Promise<PaymentResult> {
    const data = await fetchWompiTransaction(transactionId)
    if (!data) {
      return {
        status: 'pending',
        reference: transactionId,
        message: 'No pudimos confirmar el pago con Wompi todavía.',
      }
    }
    const mapped = mapWompiStatus(data.status)
    return {
      status: mapped.paymentStatus,
      reference: data.reference,
      message: data.status_message ?? undefined,
    }
  },
}
