import type { SupabaseClient } from '@supabase/supabase-js'
import { afterEach, describe, expect, it, vi } from 'vitest'
import { handleWompiEvent } from '@/lib/payments/wompi/webhook'
import type { WompiEvent } from '@/lib/payments/wompi/signature'
import { newOrderMessage } from '@/lib/push/messages'
import type { Database } from '@/types/database'

const push = vi.hoisted(() => ({
  sendPushToStoreOwner: vi.fn(async (): Promise<void> => {}),
}))
vi.mock('server-only', () => ({}))
vi.mock('@/lib/push/send', () => push)

const ORDER_ID = '11111111-1111-4111-8111-111111111111'
const REFERENCE = `ord_${ORDER_ID}`
const STORE_ID = '22222222-2222-4222-8222-222222222222'

function pendingOrder(overrides: Record<string, unknown> = {}) {
  return {
    id: ORDER_ID,
    status: 'pending',
    payment_status: 'pending',
    payment_ref: REFERENCE,
    total: '49000.00',
    store_id: STORE_ID,
    short_code: 'A1B2',
    stores: { name: 'La Parrilla' },
    ...overrides,
  }
}

interface FakeAdminOptions {
  order?: Record<string, unknown> | null
  insertError?: { code: string; message: string } | null
}

interface Recorded {
  inserts: Record<string, unknown>[]
  orderSelects: { filters: [string, unknown][] }[]
  orderUpdates: { payload: Record<string, unknown>; id: string }[]
}

function fakeAdmin(options: FakeAdminOptions = {}) {
  const recorded: Recorded = { inserts: [], orderSelects: [], orderUpdates: [] }
  const order = options.order === undefined ? null : options.order
  const admin = {
    from(table: string) {
      if (table === 'payment_events') {
        return {
          insert: async (payload: Record<string, unknown>) => {
            recorded.inserts.push(payload)
            return { error: options.insertError ?? null }
          },
        }
      }
      if (table === 'orders') {
        return {
          select: () => {
            const entry: { filters: [string, unknown][] } = { filters: [] }
            recorded.orderSelects.push(entry)
            const chain = {
              eq: (column: string, value: unknown) => {
                entry.filters.push([column, value])
                return chain
              },
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
      }
      throw new Error(`unexpected table ${table}`)
    },
  }
  return { admin: admin as unknown as SupabaseClient<Database>, recorded }
}

function buildEvent(overrides: {
  eventName?: string
  status?: string
  reference?: string
  amountInCents?: number
} = {}): WompiEvent {
  return {
    event: overrides.eventName ?? 'transaction.updated',
    environment: 'test',
    timestamp: 1700000000,
    sent_at: '2026-09-12T00:00:00.000Z',
    signature: { properties: ['transaction.id'], checksum: 'ignored' },
    data: {
      transaction: {
        id: 'tx_1',
        status: overrides.status ?? 'APPROVED',
        reference: overrides.reference ?? REFERENCE,
        amount_in_cents: overrides.amountInCents ?? 4900000,
        payment_method_type: 'CARD',
        customer_email: 'ana@example.com',
      },
    },
  }
}

afterEach(() => {
  vi.restoreAllMocks()
  push.sendPushToStoreOwner.mockClear()
})

describe('handleWompiEvent', () => {
  it('ignores events other than transaction.updated', async () => {
    const { admin, recorded } = fakeAdmin()
    const result = await handleWompiEvent(
      admin,
      buildEvent({ eventName: 'nequi_token.updated' }),
    )
    expect(result).toEqual({ outcome: 'ignored' })
    expect(recorded.inserts).toEqual([])
  })

  it('stores the event and marks the order paid on an approved transaction', async () => {
    const { admin, recorded } = fakeAdmin({ order: pendingOrder() })
    const result = await handleWompiEvent(admin, buildEvent())
    expect(result).toEqual({
      outcome: 'applied',
      paymentStatus: 'paid',
      reopened: false,
    })
    expect(push.sendPushToStoreOwner).not.toHaveBeenCalled()
    expect(recorded.inserts).toHaveLength(1)
    expect(recorded.inserts[0]).toMatchObject({
      provider: 'wompi',
      event_id: 'tx_1',
      reference: REFERENCE,
      status: 'APPROVED',
      amount_in_cents: 4900000,
      order_id: ORDER_ID,
    })
    expect(recorded.orderUpdates).toEqual([
      { payload: { payment_status: 'paid' }, id: ORDER_ID },
    ])
  })

  it('cancels a pending order on a declined transaction', async () => {
    const { admin, recorded } = fakeAdmin({ order: pendingOrder() })
    const result = await handleWompiEvent(
      admin,
      buildEvent({ status: 'DECLINED' }),
    )
    expect(result).toEqual({
      outcome: 'applied',
      paymentStatus: 'failed',
      reopened: false,
    })
    expect(recorded.orderUpdates).toEqual([
      {
        payload: { payment_status: 'failed', status: 'cancelled' },
        id: ORDER_ID,
      },
    ])
  })

  it('reopens an auto-cancelled order on a late approval and notifies the merchant', async () => {
    const { admin, recorded } = fakeAdmin({
      order: pendingOrder({ status: 'cancelled', payment_status: 'failed' }),
    })
    const result = await handleWompiEvent(admin, buildEvent())
    expect(result).toEqual({
      outcome: 'applied',
      paymentStatus: 'paid',
      reopened: true,
    })
    expect(recorded.orderUpdates).toEqual([
      { payload: { payment_status: 'paid', status: 'pending' }, id: ORDER_ID },
    ])
    expect(push.sendPushToStoreOwner).toHaveBeenCalledWith(
      STORE_ID,
      newOrderMessage('A1B2', 'La Parrilla'),
    )
  })

  it('reports a duplicate on a unique-constraint violation without touching the order', async () => {
    const { admin, recorded } = fakeAdmin({
      insertError: { code: '23505', message: 'duplicate key' },
    })
    const result = await handleWompiEvent(admin, buildEvent())
    expect(result).toEqual({ outcome: 'duplicate' })
    expect(recorded.orderSelects).toEqual([])
    expect(recorded.orderUpdates).toEqual([])
  })

  it('reports store_failed when the event cannot be persisted for any other reason', async () => {
    const log = vi.spyOn(console, 'error').mockImplementation(() => {})
    const { admin, recorded } = fakeAdmin({
      order: pendingOrder(),
      insertError: { code: '57P01', message: 'connection lost' },
    })
    const result = await handleWompiEvent(admin, buildEvent())
    expect(result).toEqual({ outcome: 'store_failed' })
    expect(recorded.orderSelects).toEqual([])
    expect(recorded.orderUpdates).toEqual([])
    expect(log).toHaveBeenCalled()
  })

  it('reports order_not_found when no order matches the reference', async () => {
    const { admin } = fakeAdmin({ order: null })
    const result = await handleWompiEvent(admin, buildEvent())
    expect(result).toEqual({ outcome: 'order_not_found' })
  })

  it('reports amount_mismatch and never touches the order on a wrong amount', async () => {
    const log = vi.spyOn(console, 'error').mockImplementation(() => {})
    const { admin, recorded } = fakeAdmin({ order: pendingOrder() })
    const result = await handleWompiEvent(
      admin,
      buildEvent({ amountInCents: 1 }),
    )
    expect(result).toEqual({ outcome: 'amount_mismatch' })
    expect(recorded.orderUpdates).toEqual([])
    expect(log).toHaveBeenCalled()
  })
})
