import type { PaymentProvider, PaymentResult } from '@/lib/payments/types'

// Cash on delivery / at the counter. The order is created as pending payment
// and the restaurant marks it paid when the money changes hands.
export const cashProvider: PaymentProvider = {
  method: 'cash',
  label: 'Efectivo',
  description: 'Pagas al recibir o al recoger tu pedido.',
  isAvailable() {
    return true
  },
  async createPayment(input): Promise<PaymentResult> {
    return { status: 'pending', reference: `cash_${input.shortCode}` }
  },
  async verifyPayment(reference): Promise<PaymentResult> {
    return { status: 'pending', reference }
  },
}
