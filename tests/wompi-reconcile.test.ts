import type { SupabaseClient } from '@supabase/supabase-js'
import { afterEach, describe, expect, it, vi } from 'vitest'
import { reconcileWompiTransaction } from '@/lib/payments/wompi/reconcile'
import { newOrderMessage } from '@/lib/push/messages'
import type { Database } from '@/types/database'

const state = vi.hoisted(() => ({
  admin: null as unknown,
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
  wompiConfigured: () => true,
}))
vi.mock('@/lib/supabase/admin', () => ({
  createAdminClient: () => state.admin,
}))
vi.mock('@/lib/push/send', () => ({
  sendPushToStoreOwner: state.sendPushToStoreOwner,
}))

const ORDER_ID = '11111111-1111-4111-8111-111111111111'
const STORE_ID = '22222222-2222-4222-8222-222222222222'
const REFERENCE = `ord_${ORDER_ID}`

interface Recorded {
  orderUpdates: { payload: Record<string, unknown>; id: string }[]
}

function fakeAdmin(order: Record<string, unknown> | null) {
  const recorded: Recorded = { orderUpdates: [] }
  const admin = {
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
          eq: async (_column: string, value: string) => {
            recorded.orderUpdates.push({ payload, id: value })
            return { error: null }
          },
        }),
      }
    },
  }
  state.admin = admin as unknown as SupabaseClient<Database>
  return recorded
}

function wompiOrder(overrides: Record<string, unknown> = {}) {
  return {
    id: ORDER_ID,
    status: 'pending',
    payment_status: 'pending',
    payment_ref: REFERENCE,
    payment_method: 'wompi',
    store_id: STORE_ID,
    short_code: 'A1B2',
    stores: { name: 'La Parrilla' },
    ...overrides,
  }
}

function transaction(overrides: Record<string, unknown> = {}) {
  return {
    id: 'tx_1',
    status: 'APPROVED',
    reference: REFERENCE,
    amount_in_cents: 4900000,
    currency: 'COP',
    ...overrides,
  }
}

afterEach(() => {
  vi.restoreAllMocks()
  state.sendPushToStoreOwner.mockClear()
})

describe('reconcileWompiTransaction', () => {
  it('applies paid on a matching approved transaction', async () => {
    const recorded = fakeAdmin(wompiOrder())
    const fetchTransaction = vi.fn(async () => transaction())

    const result = await reconcileWompiTransaction(ORDER_ID, 'tx_1', {
      fetchTransaction,
    })

    expect(result).toEqual({ paymentStatus: 'paid' })
    expect(fetchTransaction).toHaveBeenCalledWith('tx_1')
    expect(recorded.orderUpdates).toEqual([
      { payload: { payment_status: 'paid' }, id: ORDER_ID },
    ])
    expect(state.sendPushToStoreOwner).not.toHaveBeenCalled()
  })

  it('returns null and writes nothing on a reference mismatch', async () => {
    const log = vi.spyOn(console, 'error').mockImplementation(() => {})
    const recorded = fakeAdmin(wompiOrder())
    const fetchTransaction = vi.fn(async () =>
      transaction({ reference: 'ord_someone-else' }),
    )

    const result = await reconcileWompiTransaction(ORDER_ID, 'tx_1', {
      fetchTransaction,
    })

    expect(result).toBeNull()
    expect(recorded.orderUpdates).toEqual([])
    expect(log).toHaveBeenCalled()
  })

  it('returns null and writes nothing when the gateway lookup fails', async () => {
    const recorded = fakeAdmin(wompiOrder())
    const fetchTransaction = vi.fn(async () => null)

    const result = await reconcileWompiTransaction(ORDER_ID, 'tx_1', {
      fetchTransaction,
    })

    expect(result).toBeNull()
    expect(recorded.orderUpdates).toEqual([])
  })

  it('skips orders that are not paid through Wompi', async () => {
    const recorded = fakeAdmin(wompiOrder({ payment_method: 'cash' }))
    const fetchTransaction = vi.fn(async () => transaction())

    const result = await reconcileWompiTransaction(ORDER_ID, 'tx_1', {
      fetchTransaction,
    })

    expect(result).toBeNull()
    expect(fetchTransaction).not.toHaveBeenCalled()
    expect(recorded.orderUpdates).toEqual([])
  })

  it('reopens an auto-cancelled order and notifies the merchant on a late approval', async () => {
    const recorded = fakeAdmin(
      wompiOrder({ status: 'cancelled', payment_status: 'failed' }),
    )
    const fetchTransaction = vi.fn(async () => transaction())

    const result = await reconcileWompiTransaction(ORDER_ID, 'tx_1', {
      fetchTransaction,
    })

    expect(result).toEqual({ paymentStatus: 'paid' })
    expect(recorded.orderUpdates).toEqual([
      { payload: { payment_status: 'paid', status: 'pending' }, id: ORDER_ID },
    ])
    expect(state.sendPushToStoreOwner).toHaveBeenCalledWith(
      STORE_ID,
      newOrderMessage('A1B2', 'La Parrilla'),
    )
  })
})
