import { describe, expect, it } from 'vitest'
import {
  planStatementLines,
  statementDisplayStatus,
  statementDueOn,
  type StatementOrderFacts,
} from '@/lib/companies/statement'

const PERIOD = '2026-11-01'

function order(
  id: string,
  overrides: Partial<StatementOrderFacts> = {},
): StatementOrderFacts {
  return {
    id,
    payment_method: 'corporate',
    payment_status: 'paid',
    status: 'delivered',
    total: 50_000,
    corporate_period: PERIOD,
    delivered_at: '2026-11-15T18:00:00Z',
    ...overrides,
  }
}

describe('planStatementLines', () => {
  it('bills every delivered corporate order of the period', () => {
    const plan = planStatementLines({
      period: PERIOD,
      orders: [order('a'), order('b', { total: 20_000 })],
      refunds: [],
      billed: [],
    })
    expect(plan.lines).toEqual([
      { order_id: 'a', kind: 'charge', amount: 50_000 },
      { order_id: 'b', kind: 'charge', amount: 20_000 },
    ])
    expect(plan.total).toBe(70_000)
  })

  it('leaves out cancelled, undelivered and already billed orders', () => {
    const plan = planStatementLines({
      period: PERIOD,
      orders: [
        order('cancelled', { status: 'cancelled' }),
        order('on-the-way', { status: 'picked_up', delivered_at: null }),
        order('billed'),
        order('cash', { payment_method: 'cash' }),
      ],
      refunds: [],
      billed: [{ order_id: 'billed', kind: 'charge' }],
    })
    expect(plan.lines).toEqual([])
    expect(plan.total).toBe(0)
  })

  it('catches up an earlier period delivered late, never a later one', () => {
    const plan = planStatementLines({
      period: PERIOD,
      orders: [
        order('late', {
          corporate_period: '2026-10-01',
          delivered_at: '2026-11-01T06:00:00Z',
        }),
        order('next-month', {
          corporate_period: '2026-12-01',
          delivered_at: '2026-12-01T06:00:00Z',
        }),
        // Placed on 30 Nov at 23:50 in Bogotá, delivered after midnight:
        // after the period's end, so it waits for December's statement.
        order('after-close', { delivered_at: '2026-12-01T05:20:00Z' }),
      ],
      refunds: [],
      billed: [],
    })
    expect(plan.lines.map((line) => line.order_id)).toEqual(['late'])
  })

  it('credits a refund once, on the statement after its charge or with it', () => {
    const plan = planStatementLines({
      period: PERIOD,
      orders: [order('new', { payment_status: 'refunded' })],
      refunds: [
        { order_id: 'new', amount: 50_000, issued_at: '2026-11-20T15:00:00Z' },
        { order_id: 'old', amount: 30_000, issued_at: '2026-11-03T15:00:00Z' },
        { order_id: 'done', amount: 10_000, issued_at: '2026-11-03T15:00:00Z' },
        {
          order_id: 'never-billed',
          amount: 9_000,
          issued_at: '2026-11-03T15:00:00Z',
        },
        { order_id: 'old2', amount: 7_000, issued_at: '2026-12-02T15:00:00Z' },
      ],
      billed: [
        { order_id: 'old', kind: 'charge' },
        { order_id: 'old2', kind: 'charge' },
        { order_id: 'done', kind: 'charge' },
        { order_id: 'done', kind: 'refund' },
      ],
    })
    expect(plan.lines).toEqual([
      { order_id: 'new', kind: 'charge', amount: 50_000 },
      { order_id: 'new', kind: 'refund', amount: -50_000 },
      { order_id: 'old', kind: 'refund', amount: -30_000 },
    ])
    expect(plan.total).toBe(-30_000)
  })
})

describe('statementDueOn', () => {
  it('is the issue date plus the payment terms', () => {
    expect(statementDueOn('2026-12-01', 30)).toBe('2026-12-31')
    expect(statementDueOn('2026-12-01', 0)).toBe('2026-12-01')
  })
})

describe('statementDisplayStatus', () => {
  it('shows an issued statement past due as overdue before the nightly job', () => {
    const issued = {
      status: 'issued',
      total: 1000,
      due_on: '2026-11-20',
    } as const
    expect(statementDisplayStatus(issued, '2026-11-21')).toBe('overdue')
    expect(statementDisplayStatus(issued, '2026-11-20')).toBe('issued')
    expect(
      statementDisplayStatus({ ...issued, status: 'paid' }, '2026-12-30'),
    ).toBe('paid')
    expect(
      statementDisplayStatus({ ...issued, total: -10 }, '2026-12-30'),
    ).toBe('issued')
  })
})
