'use client'

import {
  useRealtimeChannel,
  useRealtimeRefresh,
} from '@/components/providers/realtime-provider'

/**
 * Keeps the "Mis pedidos" list on the account page current.
 *
 * One channel for the whole list, filtered server-side to this customer's
 * orders; the event only triggers the refresh, because the list also renders
 * the store name and the total, which the payload does not carry.
 */
export function AccountOrdersLive({ customerId }: { customerId: string }) {
  const refresh = useRealtimeRefresh()

  useRealtimeChannel({
    name: `customer-orders-${customerId}`,
    table: 'orders',
    event: 'UPDATE',
    filter: `customer_id=eq.${customerId}`,
    onEvent: () => refresh(),
  })

  return null
}
