// @vitest-environment node
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'

vi.mock('server-only', () => ({}))

// ---------------------------------------------------------------------------
// The screen is capped, so something falls off. It used to be the oldest rows
// — the ones that have been costing money the longest — and the page showed
// only the truncated count, so a backlog of thousands read as exactly 200.
// ---------------------------------------------------------------------------

interface Query {
  select: [string, unknown]
  order: [string, unknown]
  limit: number
}

let captured: Query
let response: { data: unknown[]; count: number | null }

function builder() {
  const self: Record<string, unknown> = {}
  self.select = (columns: string, options: unknown) => {
    captured.select = [columns, options]
    return self
  }
  self.is = () => self
  self.order = (column: string, options: unknown) => {
    captured.order = [column, options]
    return self
  }
  self.limit = (value: number) => {
    captured.limit = value
    return self
  }
  self.then = (onOk: (value: unknown) => unknown) =>
    Promise.resolve({ ...response, error: null }).then(onOk)
  return self
}

vi.mock('@/lib/supabase/server', () => ({
  createClient: async () => ({ from: () => builder() }),
}))

function event(overrides: Record<string, unknown> = {}) {
  return {
    id: 'event-1',
    provider: 'wompi',
    status: 'APPROVED',
    reference: 'ref-1',
    amount_in_cents: 1_000_000,
    received_at: '2026-09-01T10:00:00.000Z',
    orders: {
      id: 'order-1',
      short_code: 'A1B2',
      status: 'delivered',
      payment_method: 'wompi',
      payment_status: 'pending',
      total: 10000,
    },
    ...overrides,
  }
}

beforeEach(() => {
  captured = { select: ['', null], order: ['', null], limit: 0 }
  response = { data: [], count: 0 }
  vi.resetModules()
})

afterEach(() => {
  vi.restoreAllMocks()
})

async function fetchSnapshot() {
  const { fetchStuckPaymentEvents } = await import(
    '@/lib/payments/stuck-events'
  )
  return fetchStuckPaymentEvents()
}

describe('fetchStuckPaymentEvents', () => {
  it('keeps the oldest events when the backlog exceeds the cap', async () => {
    // Descending would drop exactly the rows that have been wrong longest,
    // and those are the only ones that will not fix themselves.
    await fetchSnapshot()
    expect(captured.order).toEqual(['received_at', { ascending: true }])
  })

  it('asks for a total that the cap does not truncate', async () => {
    await fetchSnapshot()
    expect(captured.select[1]).toEqual({ count: 'exact' })
  })

  it('reports the real size of the backlog, not the page size', async () => {
    const { STUCK_EVENTS_LIMIT } = await import('@/lib/payments/stuck-events')
    response = {
      data: Array.from({ length: STUCK_EVENTS_LIMIT }, (_, index) =>
        event({ id: `event-${index}` }),
      ),
      count: 4137,
    }

    const snapshot = await fetchSnapshot()

    expect(snapshot.total).toBe(4137)
    expect(snapshot.rows).toHaveLength(STUCK_EVENTS_LIMIT)
    expect(snapshot.truncated).toBe(true)
  })

  it('is not truncated when every stuck event fits', async () => {
    response = { data: [event()], count: 1 }

    const snapshot = await fetchSnapshot()

    expect(snapshot.truncated).toBe(false)
    expect(snapshot.total).toBe(1)
  })

  it('falls back to what it has when the database answered no count', async () => {
    // Claiming zero would be the one wrong answer: it reads as "nothing is
    // stuck" on a screen that exists to say how much is.
    response = { data: [event()], count: null }

    const snapshot = await fetchSnapshot()

    expect(snapshot.total).toBe(1)
    expect(snapshot.truncated).toBe(false)
  })

  it('puts the oldest of the expensive events first', async () => {
    response = {
      data: [
        event({ id: 'new-approved', received_at: '2026-09-18T10:00:00.000Z' }),
        event({ id: 'old-approved', received_at: '2026-08-01T10:00:00.000Z' }),
        event({
          id: 'declined',
          status: 'DECLINED',
          received_at: '2026-07-01T10:00:00.000Z',
        }),
      ],
      count: 3,
    }

    const snapshot = await fetchSnapshot()

    expect(snapshot.rows.map((row) => row.id)).toEqual([
      'old-approved',
      'new-approved',
      'declined',
    ])
  })
})
