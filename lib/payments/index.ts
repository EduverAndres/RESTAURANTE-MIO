import {
  cashProvider,
  corporateProvider,
  mockProvider,
  wompiProvider,
  mercadopagoProvider,
} from '@/lib/payments/providers'
import type { PaymentProvider } from '@/lib/payments/types'
import type { PaymentMethod } from '@/types/app'

// Registry of gateways. Adding a new provider only requires exporting it from
// `lib/payments/providers` and adding a line here.
const PROVIDERS: Partial<Record<PaymentMethod, PaymentProvider>> = {
  cash: cashProvider,
  mock: mockProvider,
  wompi: wompiProvider,
  mercadopago: mercadopagoProvider,
  corporate: corporateProvider,
}

/**
 * Methods that depend on who is paying, so the checkout offers them itself
 * instead of listing them for everyone: "Cuenta de empresa" exists only for
 * an active member of an active company (lib/companies/server.ts).
 */
const CONTEXTUAL: readonly PaymentMethod[] = ['corporate']

export function getPaymentProvider(
  method: PaymentMethod,
): PaymentProvider | null {
  const provider = PROVIDERS[method]
  return provider && provider.isAvailable() ? provider : null
}

export interface PaymentOption {
  method: PaymentMethod
  label: string
  description: string
}

/** Serialisable list for the checkout UI (no functions cross the boundary). */
export function listPaymentOptions(): PaymentOption[] {
  return Object.values(PROVIDERS)
    .filter(
      (provider): provider is PaymentProvider =>
        Boolean(provider?.isAvailable()) &&
        !CONTEXTUAL.includes(provider!.method),
    )
    .map(({ method, label, description }) => ({ method, label, description }))
}

export type {
  PaymentProvider,
  PaymentResult,
  CreatePaymentInput,
} from '@/lib/payments/types'
