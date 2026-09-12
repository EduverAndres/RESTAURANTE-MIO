import { cashProvider } from '@/lib/payments/cash'
import { mockProvider } from '@/lib/payments/mock'
import type { PaymentProvider } from '@/lib/payments/types'
import { wompiProvider } from '@/lib/payments/wompi/provider'
import type { PaymentMethod } from '@/types/app'

// Registry of gateways. Mercado Pago is wired in a later phase; the registry
// shape does not change when it is added.
const PROVIDERS: Partial<Record<PaymentMethod, PaymentProvider>> = {
  cash: cashProvider,
  mock: mockProvider,
  wompi: wompiProvider,
}

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
    .filter((provider): provider is PaymentProvider =>
      Boolean(provider?.isAvailable()),
    )
    .map(({ method, label, description }) => ({ method, label, description }))
}

export type {
  PaymentProvider,
  PaymentResult,
  CreatePaymentInput,
} from '@/lib/payments/types'
