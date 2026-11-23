'use client'

import { useRouter } from 'next/navigation'
import { useRealtimeChannel } from '@/components/providers/realtime-provider'

/**
 * Refreshes the customer's reservations when the store answers, so "Por
 * confirmar" turns into "Confirmada" on screen without a reload, even for a
 * customer who never enabled push notifications.
 */
export function AccountReservationsLive({ userId }: { userId: string }) {
  const router = useRouter()
  useRealtimeChannel({
    name: `customer-reservations-${userId}`,
    table: 'reservations',
    event: 'UPDATE',
    filter: `customer_id=eq.${userId}`,
    onEvent: () => router.refresh(),
  })
  return null
}
