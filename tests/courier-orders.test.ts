import { describe, expect, it } from 'vitest'
import {
  splitCourierOrders,
  toCourierOrderSummary,
  type CourierOrderRow,
} from '@/lib/courier/orders'

const row: CourierOrderRow = {
  id: 'o1',
  short_code: 'AB12',
  status: 'ready',
  created_at: '2026-01-01T12:00:00.000Z',
  delivery_fee: 4500,
  estimated_at: null,
  address_id: 'a1',
  stores: { name: 'La Esquina', lat: 4.65, lng: -74.08 },
}

describe('toCourierOrderSummary', () => {
  it('maps the row and computes the store→customer distance', () => {
    const summary = toCourierOrderSummary(row, {
      line1: 'Calle 1 # 2-3',
      line2: 'Apto 401',
      lat: 4.66,
      lng: -74.08,
    })
    expect(summary).toMatchObject({
      id: 'o1',
      shortCode: 'AB12',
      status: 'ready',
      storeName: 'La Esquina',
      deliveryFee: 4500,
      addressLine: 'Calle 1 # 2-3, Apto 401',
    })
    expect(summary.distanceKm).toBeGreaterThan(1)
    expect(summary.distanceKm).toBeLessThan(1.2)
  })

  it('degrades when the address or coordinates are missing', () => {
    const noAddress = toCourierOrderSummary(row, null)
    expect(noAddress.addressLine).toBeNull()
    expect(noAddress.distanceKm).toBeNull()
    expect(noAddress.storeName).toBe('La Esquina')

    const noCoords = toCourierOrderSummary(
      { ...row, stores: null },
      { line1: 'Calle 1', line2: null, lat: 4.66, lng: -74.08 },
    )
    expect(noCoords.storeName).toBe('Tienda')
    expect(noCoords.addressLine).toBe('Calle 1')
    expect(noCoords.distanceKm).toBeNull()
  })
})

describe('splitCourierOrders', () => {
  it('separates active deliveries from finished ones', () => {
    const base = toCourierOrderSummary(row, null)
    const list = [
      { ...base, id: '1', status: 'ready' as const },
      { ...base, id: '2', status: 'delivered' as const },
      { ...base, id: '3', status: 'picked_up' as const },
      { ...base, id: '4', status: 'cancelled' as const },
    ]
    const { active, history } = splitCourierOrders(list)
    expect(active.map((order) => order.id)).toEqual(['1', '3'])
    expect(history.map((order) => order.id)).toEqual(['2', '4'])
  })
})
