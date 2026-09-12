import { describe, expect, it } from 'vitest'
import {
  GUEST_ORDERS_COOKIE,
  GUEST_ORDERS_MAX,
  GUEST_ORDERS_MAX_AGE_SECONDS,
  addGuestOrder,
  hasGuestOrder,
  parseGuestOrders,
  serializeGuestOrders,
} from '@/lib/orders/guest-orders'

const id = (n: number) => `00000000-0000-4000-8000-${String(n).padStart(12, '0')}`

describe('guest order cookie', () => {
  it('exposes the cookie contract', () => {
    expect(GUEST_ORDERS_COOKIE).toBe('tienda_guest_orders')
    expect(GUEST_ORDERS_MAX).toBe(10)
    expect(GUEST_ORDERS_MAX_AGE_SECONDS).toBe(24 * 60 * 60)
  })

  it('parses a JSON array of uuids', () => {
    expect(parseGuestOrders(JSON.stringify([id(1), id(2)]))).toEqual([
      id(1),
      id(2),
    ])
  })

  it('drops anything that is not a uuid and tolerates garbage', () => {
    expect(parseGuestOrders(undefined)).toEqual([])
    expect(parseGuestOrders('')).toEqual([])
    expect(parseGuestOrders('not json')).toEqual([])
    expect(parseGuestOrders('{"a":1}')).toEqual([])
    expect(parseGuestOrders(JSON.stringify([id(1), 'x', 3, null]))).toEqual([
      id(1),
    ])
  })

  it('adds the newest order first and deduplicates', () => {
    const next = addGuestOrder([id(1), id(2)], id(3))
    expect(next).toEqual([id(3), id(1), id(2)])
    expect(addGuestOrder(next, id(1))).toEqual([id(1), id(3), id(2)])
  })

  it('keeps at most ten ids', () => {
    let ids: string[] = []
    for (let n = 1; n <= 12; n += 1) ids = addGuestOrder(ids, id(n))
    expect(ids).toHaveLength(GUEST_ORDERS_MAX)
    expect(ids[0]).toBe(id(12))
    expect(ids).not.toContain(id(1))
  })

  it('serialises back to JSON that parses to the same list', () => {
    const ids = [id(2), id(1)]
    expect(parseGuestOrders(serializeGuestOrders(ids))).toEqual(ids)
  })

  it('checks membership from the raw cookie value', () => {
    const raw = serializeGuestOrders([id(1)])
    expect(hasGuestOrder(raw, id(1))).toBe(true)
    expect(hasGuestOrder(raw, id(2))).toBe(false)
    expect(hasGuestOrder(undefined, id(1))).toBe(false)
  })
})
