// @vitest-environment node
import { beforeEach, describe, expect, it, vi } from 'vitest'

vi.mock('server-only', () => ({}))
vi.mock('@/lib/env', () => ({
  env: { NEXT_PUBLIC_SITE_URL: 'https://tienda.app' },
}))
vi.mock('@/lib/payments', () => ({ listPaymentOptions: () => [] }))

let cookieValue: string | undefined
vi.mock('next/headers', () => ({
  cookies: async () => ({
    get: (name: string) =>
      name === 'tienda_guest_orders' && cookieValue !== undefined
        ? { value: cookieValue }
        : undefined,
  }),
}))

interface Query {
  table: string
  filters: [string, ...unknown[]][]
}
const queries: Query[] = []
let answer: { data: unknown; error: unknown } = { data: [], error: null }

vi.mock('@/lib/supabase/admin', () => ({
  createAdminClient: () => ({
    from(table: string) {
      const query: Query = { table, filters: [] }
      queries.push(query)
      const chain = {
        select: () => chain,
        in: (...args: unknown[]) => (
          query.filters.push(['in', ...args]),
          chain
        ),
        eq: (...args: unknown[]) => (
          query.filters.push(['eq', ...args]),
          chain
        ),
        not: (...args: unknown[]) => (
          query.filters.push(['not', ...args]),
          chain
        ),
        order: async () => answer,
      }
      return chain
    },
  }),
}))
vi.mock('@/lib/supabase/server', () => ({ createClient: async () => ({}) }))

const ORDER_A = '7f1c1d3e-8f5e-4c7a-9a39-5d5c2f6b1a10'
const ORDER_B = '0b6f1a4e-2c3d-4e5f-8a9b-1c2d3e4f5a6b'

// A guest who closed the tab had no way back to the order: the table page
// now offers "Ver mi pedido" from the same cookie the order page trusts.
describe('fetchOpenGuestOrders', () => {
  beforeEach(() => {
    queries.length = 0
    cookieValue = undefined
    answer = { data: [], error: null }
  })

  it('does not query without the guest cookie', async () => {
    const { fetchOpenGuestOrders } = await import('@/lib/tables/server')
    expect(await fetchOpenGuestOrders('store-1')).toEqual([])
    expect(queries).toEqual([])
  })

  it("reads only this store's open table orders listed in the cookie", async () => {
    cookieValue = JSON.stringify([ORDER_A, ORDER_B])
    answer = { data: [{ id: ORDER_A, short_code: 'K7Q2' }], error: null }
    const { fetchOpenGuestOrders } = await import('@/lib/tables/server')

    expect(await fetchOpenGuestOrders('store-1')).toEqual([
      { id: ORDER_A, shortCode: 'K7Q2' },
    ])
    expect(queries[0]?.table).toBe('orders')
    expect(queries[0]?.filters).toEqual([
      ['in', 'id', [ORDER_A, ORDER_B]],
      ['eq', 'store_id', 'store-1'],
      ['eq', 'type', 'table'],
      ['not', 'status', 'in', '(delivered,cancelled)'],
    ])
  })

  it('shows nothing when the lookup fails', async () => {
    vi.spyOn(console, 'error').mockImplementation(() => {})
    cookieValue = JSON.stringify([ORDER_A])
    answer = { data: null, error: { message: 'boom' } }
    const { fetchOpenGuestOrders } = await import('@/lib/tables/server')
    expect(await fetchOpenGuestOrders('store-1')).toEqual([])
  })
})
