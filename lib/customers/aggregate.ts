// Pure aggregation behind /dashboard/customers. No React, no Supabase.
import type { OrderStatus } from '@/types/app'

export interface CustomerOrder {
  customer_id: string | null
  status: OrderStatus
  total: number
  created_at: string
  customer: { full_name: string | null } | null
}

export interface CustomerRow {
  id: string
  name: string
  orders: number
  /** Sum of `total` excluding cancelled orders. */
  spent: number
  lastOrderAt: string
}

export const ANONYMOUS_CUSTOMER = 'Cliente'

/** Groups orders per customer; guests (no customer_id) are skipped. */
export function aggregateCustomers(
  orders: readonly CustomerOrder[],
): CustomerRow[] {
  const rows = new Map<string, CustomerRow>()
  for (const order of orders) {
    if (!order.customer_id) continue
    const spent = order.status === 'cancelled' ? 0 : order.total
    const existing = rows.get(order.customer_id)
    if (existing) {
      existing.orders += 1
      existing.spent += spent
      if (order.created_at > existing.lastOrderAt)
        existing.lastOrderAt = order.created_at
      if (existing.name === ANONYMOUS_CUSTOMER && order.customer?.full_name)
        existing.name = order.customer.full_name
    } else {
      rows.set(order.customer_id, {
        id: order.customer_id,
        name: order.customer?.full_name || ANONYMOUS_CUSTOMER,
        orders: 1,
        spent,
        lastOrderAt: order.created_at,
      })
    }
  }
  return [...rows.values()].sort((a, b) =>
    b.lastOrderAt.localeCompare(a.lastOrderAt),
  )
}
