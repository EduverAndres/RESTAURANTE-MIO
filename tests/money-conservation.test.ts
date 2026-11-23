import { describe, expect, it } from 'vitest'
import { courierEntryFor } from '@/lib/couriers/ledger'
import { summarizePayouts, type PayoutOrderInput } from '@/lib/payouts/compute'

// Every peso the customer pays must end up with exactly one of: the merchant,
// the courier, or the platform. Whoever physically holds the money, the
// settlements (merchant payouts and the courier ledger) must move it so the
// platform keeps its commission minus the referral credit it paid, and
// nothing else, in every combination of payment method and who delivered.

const PERIOD = { periodStart: '2026-09-14', periodEnd: '2026-09-20' }

const BASE = {
  store_id: 'store-1',
  status: 'delivered',
  type: 'delivery',
  subtotal: 40000,
  merchant_discount: 4000,
  platform_discount: 5000,
  platform_fee: 3960,
  delivery_fee: 5000,
  tip: 2000,
  delivered_at: '2026-09-15T12:00:00.000Z',
} as const

const total =
  BASE.subtotal -
  BASE.merchant_discount -
  BASE.platform_discount +
  BASE.delivery_fee +
  BASE.tip

/** Where the money sits once both settlements have run, by holder. */
function settle(order: PayoutOrderInput) {
  const [payout] = summarizePayouts([order], PERIOD)
  const courier =
    order.courier_id !== null
      ? courierEntryFor({ ...order, total })
      : { earnings: 0, cash_collected: 0 }

  // Who received the customer's money in the first place.
  const cash = order.payment_method === 'cash'
  const merchantHeld = cash && order.courier_id === null ? total : 0
  const courierHeld = cash && order.courier_id !== null ? total : 0
  const platformHeld = cash ? 0 : total

  // Then settlements move it: the payout's net from platform to merchant,
  // the courier ledger's net from platform to courier.
  const courierNet = courier.earnings - courier.cash_collected
  return {
    merchant: merchantHeld + payout.net,
    courier: courierHeld + courierNet,
    platform: platformHeld - payout.net - courierNet,
  }
}

const EXPECTED_PLATFORM = BASE.platform_fee - BASE.platform_discount

describe('money conservation across payouts and the courier ledger', () => {
  const cases = [
    {
      name: 'online, platform courier',
      payment_method: 'wompi',
      courier_id: 'c-1',
    },
    {
      name: 'online, merchant delivers',
      payment_method: 'wompi',
      courier_id: null,
    },
    {
      name: 'cash, platform courier',
      payment_method: 'cash',
      courier_id: 'c-1',
    },
    {
      name: 'cash, merchant delivers',
      payment_method: 'cash',
      courier_id: null,
    },
  ] as const

  for (const scenario of cases) {
    it(`${scenario.name}: the platform keeps commission minus credit`, () => {
      const order: PayoutOrderInput = {
        ...BASE,
        payment_method: scenario.payment_method,
        payment_status: scenario.payment_method === 'cash' ? 'pending' : 'paid',
        courier_id: scenario.courier_id,
      }
      const held = settle(order)

      expect(held.merchant + held.courier + held.platform).toBe(total)
      expect(held.platform).toBe(EXPECTED_PLATFORM)
      // Whoever delivered keeps the delivery fee and the tip.
      const deliverer = scenario.courier_id === null ? 'merchant' : 'courier'
      const sale = BASE.subtotal - BASE.merchant_discount - BASE.platform_fee
      if (deliverer === 'courier') {
        expect(held.courier).toBe(BASE.delivery_fee + BASE.tip)
        expect(held.merchant).toBe(sale)
      } else {
        expect(held.courier).toBe(0)
        expect(held.merchant).toBe(sale + BASE.delivery_fee + BASE.tip)
      }
    })
  }
})
