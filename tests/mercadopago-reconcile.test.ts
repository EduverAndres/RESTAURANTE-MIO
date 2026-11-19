import type { SupabaseClient } from '@supabase/supabase-js'
import { afterEach, describe, expect, it, vi } from 'vitest'
import { reconcileMercadoPagoPayment } from '@/lib/payments/mercadopago/reconcile'
import type { PaymentResult } from '@/lib/payments/types'
import type { Database } from '@/types/database'

const state = vi.hoisted(() => ({
  admin: null as unknown,
  configured: true,
  sendPushToStoreOwner: vi.fn(async (): Promise<void> => {}),
}))

vi.mock('server-only', () => ({}))
vi.mock('next/server', () => ({
  after: (callback: () => unknown) => {
    void callback()
  },
}))
vi.mock('@/lib/env.server', () => ({
  serverEnv: {},
  mercadopagoConfigured: () => state.configured,
}))
vi.mock('@/lib/payments/providers/mercadopago', () => ({
  mercadopagoProvider: {
    verifyPayment: async () => {
      throw new Error('the test injects verifyPayment')
    },
  },
}))
vi.mock('@/lib/supabase/admin', () => ({
  createAdminClient: () => state.admin,
}))
vi.mock('@/lib/push/send', () => ({
  sendPushToStoreOwner: state.sendPushToStoreOwner,
}))

const ORDER_ID = '11111111-1111-4111-8111-111111111111'
const STORE_ID = '22222222-2222-4222-8222-222222222222'
const PAYMENT_ID = '1234567890'

function fakeAdmin(order: Record<string, unknown> | null) {
  const updates: Record<string, unknown>[] = []
  state.admin = {
    from(table: string) {
      if (table !== 'orders') throw new Error(`unexpected table ${table}`)
      return {
        select: () => {
          const chain = {
            eq: () => chain,
            maybeSingle: async () => ({ data: order, error: null }),
          }
          return chain
        },
        update: (payload: Record<string, unknown>) => ({
          eq: async () => {
            updates.push(payload)
            return { error: null }
          },
        }),
      }
    },
  } as unknown as SupabaseClient<Database>
  return updates
}

function mpOrder(overrides: Record<string, unknown> = {}) {
  return {
    id: ORDER_ID,
    status: 'pending',
    payment_status: 'pending',
    payment_method: 'mercadopago',
    store_id: STORE_ID,
    short_code: 'A1B2',
    stores: { name: 'La Parrilla' },
    ...overrides,
  }
}

function payment(overrides: Partial<PaymentResult> = {}): PaymentResult {
  return { status: 'paid', reference: 'A1B2', ...overrides }
}

afterEach(() => {
  state.configured = true
  state.sendPushToStoreOwner.mockClear()
  vi.restoreAllMocks()
})

// The webhook used to be the only way an order learned it was paid: when it
// never arrived, the customer came back to an order stuck on "pendiente".
describe('reconcileMercadoPagoPayment', () => {
  it('marks the order paid from the payment the customer came back with', async () => {
    const updates = fakeAdmin(mpOrder())
    const verifyPayment = vi.fn(async () => payment())

    expect(
      await reconcileMercadoPagoPayment(ORDER_ID, PAYMENT_ID, {
        verifyPayment,
      }),
    ).toEqual({ paymentStatus: 'paid' })
    expect(verifyPayment).toHaveBeenCalledWith(PAYMENT_ID)
    expect(updates).toEqual([
      { payment_status: 'paid' },
      { payment_ref: PAYMENT_ID },
    ])
  })

  it("ignores a payment for another order's short code", async () => {
    vi.spyOn(console, 'error').mockImplementation(() => {})
    const updates = fakeAdmin(mpOrder())
    const result = await reconcileMercadoPagoPayment(ORDER_ID, PAYMENT_ID, {
      verifyPayment: async () => payment({ reference: 'ZZZZ' }),
    })
    expect(result).toBeNull()
    expect(updates).toEqual([])
  })

  it('writes nothing while the payment is still pending', async () => {
    const updates = fakeAdmin(mpOrder())
    expect(
      await reconcileMercadoPagoPayment(ORDER_ID, PAYMENT_ID, {
        verifyPayment: async () => payment({ status: 'pending' }),
      }),
    ).toEqual({ paymentStatus: 'pending' })
    expect(updates).toEqual([])
  })

  it('cancels a pending order whose payment was rejected', async () => {
    const updates = fakeAdmin(mpOrder())
    await reconcileMercadoPagoPayment(ORDER_ID, PAYMENT_ID, {
      verifyPayment: async () => payment({ status: 'failed' }),
    })
    expect(updates[0]).toEqual({
      payment_status: 'failed',
      status: 'cancelled',
    })
  })

  it('reopens an auto-cancelled order paid late and tells the merchant', async () => {
    fakeAdmin(mpOrder({ status: 'cancelled' }))
    await reconcileMercadoPagoPayment(ORDER_ID, PAYMENT_ID, {
      verifyPayment: async () => payment(),
    })
    expect(state.sendPushToStoreOwner).toHaveBeenCalledTimes(1)
  })

  it('does nothing for another payment method, a bad id or without Mercado Pago', async () => {
    const verifyPayment = vi.fn(async () => payment())

    fakeAdmin(mpOrder({ payment_method: 'wompi' }))
    expect(
      await reconcileMercadoPagoPayment(ORDER_ID, PAYMENT_ID, {
        verifyPayment,
      }),
    ).toBeNull()

    fakeAdmin(mpOrder())
    expect(
      await reconcileMercadoPagoPayment(ORDER_ID, 'abc', { verifyPayment }),
    ).toBeNull()

    state.configured = false
    expect(
      await reconcileMercadoPagoPayment(ORDER_ID, PAYMENT_ID, {
        verifyPayment,
      }),
    ).toBeNull()
    expect(verifyPayment).not.toHaveBeenCalled()
  })
})
