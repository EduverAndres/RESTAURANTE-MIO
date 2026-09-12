import type { PaymentProvider, PaymentResult } from '@/lib/payments/types'

// Development gateway: approves instantly unless the amount ends in 99, which
// simulates a declined card so the failure path can be exercised.
export const mockProvider: PaymentProvider = {
  method: 'mock',
  label: 'Tarjeta de prueba',
  description: 'Pago simulado para desarrollo. Se aprueba al instante.',
  isAvailable() {
    return (
      process.env.NODE_ENV !== 'production' ||
      process.env.PAYMENT_PROVIDER === 'mock'
    )
  },
  async createPayment(input): Promise<PaymentResult> {
    const declined = input.amount % 100 === 99
    return {
      status: declined ? 'failed' : 'paid',
      reference: `mock_${input.shortCode}_${Date.now().toString(36)}`,
      message: declined ? 'La tarjeta de prueba fue rechazada.' : undefined,
    }
  },
  async verifyPayment(reference): Promise<PaymentResult> {
    return { status: 'paid', reference }
  },
}
