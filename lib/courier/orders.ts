// Pure view-model builders for the courier app. The page fetches rows with
// the RLS client and (separately) the delivery addresses; this module only
// shapes them for the cards.
import { haversineKm, latLngOf } from '@/lib/geo'
import type { OrderStatus } from '@/types/app'

export interface CourierOrderRow {
  id: string
  short_code: string
  status: OrderStatus
  created_at: string
  delivery_fee: number
  estimated_at: string | null
  address_id: string | null
  stores: { name: string; lat: number | null; lng: number | null } | null
}

export interface CourierAddress {
  line1: string
  line2: string | null
  lat: number | null
  lng: number | null
}

export interface CourierOrderSummary {
  id: string
  shortCode: string
  status: OrderStatus
  createdAt: string
  estimatedAt: string | null
  deliveryFee: number
  storeName: string
  addressLine: string | null
  /** Store to customer straight-line distance; null when coordinates are missing. */
  distanceKm: number | null
}

export function formatAddressLine(
  address: Pick<CourierAddress, 'line1' | 'line2'> | null,
): string | null {
  if (!address) return null
  return address.line2 ? `${address.line1}, ${address.line2}` : address.line1
}

export function toCourierOrderSummary(
  row: CourierOrderRow,
  address: CourierAddress | null,
): CourierOrderSummary {
  const store = latLngOf(row.stores)
  const customer = latLngOf(address)
  return {
    id: row.id,
    shortCode: row.short_code,
    status: row.status,
    createdAt: row.created_at,
    estimatedAt: row.estimated_at,
    deliveryFee: Number(row.delivery_fee),
    storeName: row.stores?.name ?? 'Tienda',
    addressLine: formatAddressLine(address),
    distanceKm: store && customer ? haversineKm(store, customer) : null,
  }
}

const FINISHED: readonly OrderStatus[] = ['delivered', 'cancelled']

export function splitCourierOrders<T extends { status: OrderStatus }>(
  orders: readonly T[],
): { active: T[]; history: T[] } {
  return {
    active: orders.filter((order) => !FINISHED.includes(order.status)),
    history: orders.filter((order) => FINISHED.includes(order.status)),
  }
}
