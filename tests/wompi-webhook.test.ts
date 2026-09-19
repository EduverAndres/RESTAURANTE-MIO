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
  /** Row already in `payment_events`, read back after a unique violation. */
  storedEvent?: { applied_at: string | null } | null
  orderUpdateError?: { message: string } | null
}

interface Recorded {
  inserts: Record<string, unknown>[]
  orderSelects: { filters: [string, unknown][] }[]
  orderUpdates: { payload: Record<string, unknown>; id: string }[]
  eventSelects: { filters: [string, unknown][] }[]
  eventUpdates: {
    payload: Record<string, unknown>
    filters: [string, unknown][]
  }[]
}

function fakeAdmin(options: FakeAdminOptions = {}) {
  const recorded: Recorded = {
    inserts: [],
    orderSelects: [],
    orderUpdates: [],
    eventSelects: [],
    eventUpdates: [],
  }
  const order = options.order === undefined ? null : options.order
  const storedEvent =
    options.storedEvent === undefined ? null : options.storedEvent
  const admin = {
    from(table: string) {
      if (table === 'payment_events') {
        return {
          insert: async (payload: Record<string, unknown>) => {
            recorded.inserts.push(payload)
            return { error: options.insertError ?? null }
          },
          select: () => {
            const entry: { filters: [string, unknown][] } = { filters: [] }
            recorded.eventSelects.push(entry)
            const chain = {
              eq: (column: string, value: unknown) => {
                entry.filters.push([column, value])
                return chain
              },
              maybeSingle: async () => ({ data: storedEvent, error: null }),
            }
            return chain
          },
          update: (payload: Record<string, unknown>) => {
            const entry: {
              payload: Record<string, unknown>
              filters: [string, unknown][]
            } = { payload, filters: [] }
            recorded.eventUpdates.push(entry)
            const chain = {
              eq: (column: string, value: unknown) => {
                entry.filters.push([column, value])
                return chain
              },
              then: (
                resolve: (value: { error: null }) => unknown,
              ): unknown => resolve({ error: null }),
            }
            return chain
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
              return { error: options.orderUpdateError ?? null }
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

  it('stamps applied_at on the stored event only after the order moved', async () => {
    const { admin, recorded } = fakeAdmin({ order: pendingOrder() })
    await handleWompiEvent(admin, buildEvent())
    expect(recorded.eventUpdates).toHaveLength(1)
    const [update] = recorded.eventUpdates
    expect(typeof update.payload.applied_at).toBe('string')
    expect(update.filters).toEqual([
      ['provider', 'wompi'],
      ['event_id', 'tx_1'],
      ['status', 'APPROVED'],
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

  it('reports a duplicate when the stored event was already applied', async () => {
    const { admin, recorded } = fakeAdmin({
      insertError: { code: '23505', message: 'duplicate key' },
      storedEvent: { applied_at: '2026-09-12T00:00:00.000Z' },
    })
    const result = await handleWompiEvent(admin, buildEvent())
    expect(result).toEqual({ outcome: 'duplicate' })
    expect(recorded.orderSelects).toEqual([])
    expect(recorded.orderUpdates).toEqual([])
  })

  it('re-applies a replayed event whose stored row was never applied', async () => {
    const { admin, recorded } = fakeAdmin({
      insertError: { code: '23505', message: 'duplicate key' },
      storedEvent: { applied_at: null },
      order: pendingOrder(),
    })
    const result = await handleWompiEvent(admin, buildEvent())
    expect(result).toEqual({
      outcome: 'applied',
      paymentStatus: 'paid',
      reopened: false,
    })
    expect(recorded.orderUpdates).toEqual([
      { payload: { payment_status: 'paid' }, id: ORDER_ID },
    ])
    expect(recorded.eventUpdates).toHaveLength(1)
  })

  it('reports a duplicate when the replayed event row cannot be read back', async () => {
    const { admin, recorded } = fakeAdmin({
      insertError: { code: '23505', message: 'duplicate key' },
      storedEvent: null,
    })
    const result = await handleWompiEvent(admin, buildEvent())
    expect(result).toEqual({ outcome: 'duplicate' })
    expect(recorded.orderUpdates).toEqual([])
  })

  it('reports apply_failed and never stamps applied_at when the order update fails', async () => {
    const log = vi.spyOn(console, 'error').mockImplementation(() => {})
    const { admin, recorded } = fakeAdmin({
      order: pendingOrder(),
      orderUpdateError: { message: 'connection lost' },
    })
    const result = await handleWompiEvent(admin, buildEvent())
    expect(result).toEqual({ outcome: 'apply_failed' })
    expect(recorded.eventUpdates).toEqual([])
    expect(log).toHaveBeenCalled()
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

  it('reports order_not_found and leaves the event unapplied for review', async () => {
    const { admin, recorded } = fakeAdmin({ order: null })
    const result = await handleWompiEvent(admin, buildEvent())
    expect(result).toEqual({ outcome: 'order_not_found' })
    expect(recorded.eventUpdates).toEqual([])
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
    expect(recorded.eventUpdates).toEqual([])
    expect(log).toHaveBeenCalled()
  })
})

/**
 * Stateful stand-in for the two tables the handler touches, so a sequence of
 * deliveries can be replayed against the same data the way production would.
 *
 * `payment_events` is keyed the way the real unique constraint is —
 * `(provider, event_id, status)` — which is the whole point: a PENDING and an
 * APPROVED delivery of the SAME transaction are two different rows, so the
 * second one never hits the constraint and never short-circuits.
 */
function statefulAdmin(initialOrder: Record<string, unknown>) {
  interface EventRow {
    provider: string
    event_id: string
    status: string
    applied_at: string | null
  }
  const events: EventRow[] = []
  const order: Record<string, unknown> = { ...initialOrder }
  const orderUpdates: Record<string, unknown>[] = []
  let failNextOrderUpdate = false

  const matching = (filters: [string, unknown][]): EventRow | undefined =>
    events.find((row) =>
      filters.every(
        ([column, value]) => row[column as keyof EventRow] === value,
      ),
    )

  const admin = {
    from(table: string) {
      if (table === 'payment_events') {
        return {
          insert: async (payload: Record<string, unknown>) => {
            const duplicate = events.some(
              (row) =>
                row.provider === payload.provider &&
                row.event_id === payload.event_id &&
                row.status === payload.status,
            )
            if (duplicate) {
              return { error: { code: '23505', message: 'duplicate key' } }
            }
            events.push({
              provider: payload.provider as string,
              event_id: payload.event_id as string,
              status: payload.status as string,
              applied_at: null,
            })
            return { error: null }
          },
          select: () => {
            const filters: [string, unknown][] = []
            const chain = {
              eq: (column: string, value: unknown) => {
                filters.push([column, value])
                return chain
              },
              maybeSingle: async () => ({
                data: matching(filters) ?? null,
                error: null,
              }),
            }
            return chain
          },
          update: (payload: Record<string, unknown>) => {
            const filters: [string, unknown][] = []
            const chain = {
              eq: (column: string, value: unknown) => {
                filters.push([column, value])
                return chain
              },
              then: (resolve: (value: { error: null }) => unknown): unknown => {
                const row = matching(filters)
                if (row) Object.assign(row, payload)
                return resolve({ error: null })
              },
            }
            return chain
          },
        }
      }
      if (table === 'orders') {
        return {
          select: () => {
            const chain = {
              eq: () => chain,
              maybeSingle: async () => ({ data: { ...order }, error: null }),
            }
            return chain
          },
          update: (payload: Record<string, unknown>) => ({
            eq: async () => {
              if (failNextOrderUpdate) {
                failNextOrderUpdate = false
                return { error: { message: 'connection lost' } }
              }
              orderUpdates.push(payload)
              Object.assign(order, payload)
              return { error: null }
            },
          }),
        }
      }
      throw new Error(`unexpected table ${table}`)
    },
  }

  return {
    admin: admin as unknown as SupabaseClient<Database>,
    order,
    events,
    orderUpdates,
    failOrderUpdateOnce() {
      failNextOrderUpdate = true
    },
  }
}

describe('handleWompiEvent replay safety', () => {
  it('never downgrades a paid order when a stale PENDING delivery is retried after the APPROVED one', async () => {
    const log = vi.spyOn(console, 'error').mockImplementation(() => {})
    const state = statefulAdmin(pendingOrder())

    // 1. The PENDING delivery is stored, but the orders UPDATE fails, so the
    //    row keeps `applied_at = NULL` and the route answers non-200.
    state.failOrderUpdateOnce()
    const first = await handleWompiEvent(
      state.admin,
      buildEvent({ status: 'PENDING' }),
    )
    expect(first).toEqual({ outcome: 'apply_failed' })
    expect(state.events).toHaveLength(1)
    expect(state.events[0]?.applied_at).toBeNull()

    // 2. Before Wompi retries, the APPROVED delivery of the SAME transaction
    //    arrives. Different status, so it is a different row: no unique
    //    violation, and the order is correctly charged.
    const second = await handleWompiEvent(
      state.admin,
      buildEvent({ status: 'APPROVED' }),
    )
    expect(second).toEqual({
      outcome: 'applied',
      paymentStatus: 'paid',
      reopened: false,
    })
    expect(state.order.payment_status).toBe('paid')

    // 3. Wompi now redelivers the original PENDING event. It hits the unique
    //    constraint on the still-unapplied row, so the handler falls through
    //    to "heal" the order — against an order that is already paid.
    const replay = await handleWompiEvent(
      state.admin,
      buildEvent({ status: 'PENDING' }),
    )

    // The charge must survive. A stale event is a no-op, never a downgrade.
    expect(state.order.payment_status).toBe('paid')
    expect(state.orderUpdates).toEqual([{ payment_status: 'paid' }])
    expect(replay).toEqual({
      outcome: 'applied',
      paymentStatus: 'pending',
      reopened: false,
    })
    expect(log).toHaveBeenCalled()
  })
})
