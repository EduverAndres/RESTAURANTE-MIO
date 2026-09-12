import { describe, expect, it } from 'vitest'
import {
  aggregateCustomers,
  type CustomerOrder,
} from '@/lib/customers/aggregate'

const ORDERS: CustomerOrder[] = [
  {
    customer_id: 'u1',
    status: 'delivered',
    total: 30_000,
    created_at: '2026-09-01T10:00:00.000Z',
    customer: { full_name: 'Ana' },
  },
  {
    customer_id: 'u1',
    status: 'cancelled',
    total: 99_000,
    created_at: '2026-09-05T10:00:00.000Z',
    customer: { full_name: 'Ana' },
  },
  {
    customer_id: 'u2',
    status: 'delivered',
    total: 12_000,
    created_at: '2026-09-03T10:00:00.000Z',
    customer: null,
  },
  {
    customer_id: null,
    status: 'delivered',
    total: 5_000,
    created_at: '2026-09-04T10:00:00.000Z',
    customer: null,
  },
]

describe('aggregateCustomers', () => {
  it('groups by customer, counts orders, sums non-cancelled spend and keeps the last date', () => {
    const rows = aggregateCustomers(ORDERS)
    expect(rows).toHaveLength(2)
    expect(rows[0]).toEqual({
      id: 'u1',
      name: 'Ana',
      orders: 2,
      spent: 30_000,
      lastOrderAt: '2026-09-05T10:00:00.000Z',
    })
  })

  it('sorts by most recent order and labels anonymous profiles', () => {
    const rows = aggregateCustomers(ORDERS)
    expect(rows.map((row) => row.id)).toEqual(['u1', 'u2'])
    expect(rows[1].name).toBe('Cliente')
  })

  it('returns an empty list for no orders', () => {
    expect(aggregateCustomers([])).toEqual([])
  })
})
