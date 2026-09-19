// @vitest-environment node
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import { REFUND_REJECTION_MESSAGES, type RefundOrder } from '@/lib/refunds/plan'

vi.mock('server-only', () => ({}))

// ---------------------------------------------------------------------------
// Recording a refund used to be two writes with a compensating delete between
// them. When that delete also failed, a refund row stayed committed on an
// order that still read as paid — payout generation then settled the sale in
// full and the refund produced no clawback, because it predated every payout.
// The two writes are now one transaction, and this suite is what keeps them
// from drifting back apart.
// ---------------------------------------------------------------------------

interface RpcCall {
  name: string
  args: Record<string, unknown>
}

function fakeAdmin(result: {
  data?: unknown
  error?: { message: string } | null
}) {
  const calls: RpcCall[] = []
  const admin = {
    rpc: async (name: string, args: Record<string, unknown>) => {
      calls.push({ name, args })
      return { data: result.data ?? null, error: result.error ?? null }
    },
    from(table: string) {
      throw new Error(
        `recordRefund must not touch "${table}" directly: the refund and the order move together`,
      )
    },
  }
  return { admin, calls }
}

let current: ReturnType<typeof fakeAdmin>

vi.mock('@/lib/supabase/admin', () => ({
  createAdminClient: () => current.admin,
}))

function order(overrides: Partial<RefundOrder> = {}): RefundOrder {
  return {
    id: '11111111-1111-4111-8111-111111111111',
    store_id: '22222222-2222-4222-8222-222222222222',
    total: 42500,
    status: 'delivered',
    payment_status: 'paid',
    payment_method: 'wompi',
    ...overrides,
  }
}

const INPUT = { reason: 'customer_request', method: 'cash', note: null } as const

beforeEach(() => {
  vi.resetModules()
})

afterEach(() => {
  vi.restoreAllMocks()
})

async function record(overrides: Partial<RefundOrder> = {}) {
  const { recordRefund } = await import('@/lib/refunds/record')
  return recordRefund({
    order: order(overrides),
    input: { ...INPUT },
    issuedBy: '33333333-3333-4333-8333-333333333333',
    actor: 'merchant',
  })
}

describe('recordRefund', () => {
  it('writes the refund and moves the order in one atomic call', async () => {
    current = fakeAdmin({ data: 'ok' })

    expect(await record()).toEqual({ ok: true })
    expect(current.calls).toEqual([
      {
        name: 'record_refund',
        args: {
          p_order_id: '11111111-1111-4111-8111-111111111111',
          p_expected_payment_status: 'paid',
          p_amount: 42500,
          p_reason: 'customer_request',
          p_method: 'cash',
          p_note: null,
          p_issued_by: '33333333-3333-4333-8333-333333333333',
        },
      },
    ])
  })

  it('pins the status the decision was made against', async () => {
    // FINDING 3's other half: the transaction refuses unless the order still
    // holds this status, so a plan decided on a stale read is never applied.
    current = fakeAdmin({ data: 'ok' })
    await record({ payment_status: 'pending', payment_method: 'cash' })
    expect(current.calls[0].args.p_expected_payment_status).toBe('pending')
  })

  it('asks the person to look again when the order moved underneath them', async () => {
    current = fakeAdmin({ data: 'status_changed' })

    expect(await record()).toEqual({
      ok: false,
      error: REFUND_REJECTION_MESSAGES.status_changed,
    })
  })

  it('reports a second refund as already refunded', async () => {
    current = fakeAdmin({ data: 'already_refunded' })

    expect(await record()).toEqual({
      ok: false,
      error: REFUND_REJECTION_MESSAGES.already_refunded,
    })
  })

  it('treats a vanished order as not refundable', async () => {
    current = fakeAdmin({ data: 'order_not_found' })

    expect(await record()).toEqual({
      ok: false,
      error: REFUND_REJECTION_MESSAGES.not_refundable,
    })
  })

  it('fails closed on a transport error rather than reporting success', async () => {
    current = fakeAdmin({ error: { message: 'connection reset' } })

    const result = await record()

    expect(result.ok).toBe(false)
  })

  it('refuses an unrefundable order before reaching the database', async () => {
    current = fakeAdmin({ data: 'ok' })

    expect(await record({ payment_status: 'refunded' })).toEqual({
      ok: false,
      error: REFUND_REJECTION_MESSAGES.already_refunded,
    })
    expect(current.calls).toEqual([])
  })
})
