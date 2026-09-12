import { describe, expect, it } from 'vitest'
import {
  KANBAN_COLUMNS,
  elapsedLabel,
  groupOrdersForBoard,
  itemsSummary,
  startOfLocalDay,
  type BoardOrder,
} from '@/lib/orders/kanban'

const NOW = new Date('2026-09-11T15:00:00.000Z')

function order(overrides: Partial<BoardOrder> & { id: string }): BoardOrder {
  return {
    short_code: 'ABC123',
    status: 'pending',
    type: 'delivery',
    table_number: null,
    total: 25000,
    notes: null,
    created_at: '2026-09-11T14:50:00.000Z',
    customer_name: 'Ana',
    items: [{ name: 'Hamburguesa', quantity: 1 }],
    ...overrides,
  }
}

describe('KANBAN_COLUMNS', () => {
  it('lists the five active statuses in flow order with Spanish titles', () => {
    expect(KANBAN_COLUMNS.map((column) => column.status)).toEqual([
      'pending',
      'accepted',
      'preparing',
      'ready',
      'picked_up',
    ])
    expect(KANBAN_COLUMNS[0].title).toBe('Nuevos')
    expect(KANBAN_COLUMNS[4].title).toBe('En camino')
  })
})

describe('groupOrdersForBoard', () => {
  it('splits active orders per column and terminal ones into history', () => {
    const board = groupOrdersForBoard([
      order({ id: '1', status: 'pending' }),
      order({ id: '2', status: 'preparing' }),
      order({ id: '3', status: 'delivered' }),
      order({ id: '4', status: 'cancelled' }),
      order({ id: '5', status: 'pending', created_at: '2026-09-11T14:00:00Z' }),
    ])
    expect(board.columns.pending.map((item) => item.id)).toEqual(['5', '1'])
    expect(board.columns.preparing.map((item) => item.id)).toEqual(['2'])
    expect(board.columns.accepted).toEqual([])
    expect(board.history.map((item) => item.id)).toEqual(['3', '4'])
  })

  it('orders active columns oldest first and history newest first', () => {
    const board = groupOrdersForBoard([
      order({
        id: 'old',
        status: 'delivered',
        created_at: '2026-09-11T10:00:00Z',
      }),
      order({
        id: 'new',
        status: 'delivered',
        created_at: '2026-09-11T12:00:00Z',
      }),
    ])
    expect(board.history.map((item) => item.id)).toEqual(['new', 'old'])
  })
})

describe('elapsedLabel', () => {
  it('formats minutes and hours in Spanish', () => {
    expect(elapsedLabel('2026-09-11T14:59:40.000Z', NOW)).toBe('ahora')
    expect(elapsedLabel('2026-09-11T14:50:00.000Z', NOW)).toBe('hace 10 min')
    expect(elapsedLabel('2026-09-11T13:30:00.000Z', NOW)).toBe(
      'hace 1 h 30 min',
    )
    expect(elapsedLabel('2026-09-11T11:00:00.000Z', NOW)).toBe('hace 4 h')
  })
})

describe('itemsSummary', () => {
  it('joins quantities and names, truncating long lists', () => {
    expect(itemsSummary([{ name: 'Papas', quantity: 2 }])).toBe('2× Papas')
    expect(
      itemsSummary([
        { name: 'A', quantity: 1 },
        { name: 'B', quantity: 3 },
        { name: 'C', quantity: 1 },
        { name: 'D', quantity: 1 },
      ]),
    ).toBe('1× A, 3× B, 1× C +1 más')
    expect(itemsSummary([])).toBe('Sin productos')
  })
})

describe('startOfLocalDay', () => {
  it('returns midnight of the given date in local time', () => {
    const start = startOfLocalDay(new Date(2026, 8, 11, 15, 30))
    expect(start.getHours()).toBe(0)
    expect(start.getMinutes()).toBe(0)
    expect(start.getDate()).toBe(11)
  })
})
