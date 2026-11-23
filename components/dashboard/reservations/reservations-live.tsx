'use client'

import { useRouter } from 'next/navigation'
import { toast } from 'sonner'
import { useRealtimeChannel } from '@/components/providers/realtime-provider'
import { formatReservationWhen, partyLabel } from '@/lib/reservations/format'
import { playSoundEvent } from '@/lib/sound/player'

interface ReservationChange {
  id: string
  status: string
  party_size: number
  starts_at: string
}

/**
 * Listens for the store's reservations wherever the owner is in the panel:
 * they spend the service on the order board, so a new request must ring and
 * show up there, not only on the reservations page. Refreshing the route
 * also updates the pending count in the navigation.
 */
export function ReservationsLive({ storeId }: { storeId: string }) {
  const router = useRouter()

  useRealtimeChannel({
    name: `store-reservations-${storeId}`,
    table: 'reservations',
    event: '*',
    filter: `store_id=eq.${storeId}`,
    onEvent: (payload) => {
      const row = payload.new as unknown as ReservationChange | undefined
      const previous = payload.old as unknown as
        Partial<ReservationChange> | undefined
      if (payload.eventType === 'INSERT' && row?.status === 'pending') {
        playSoundEvent('new_reservation')
        toast(`Nueva reserva · ${partyLabel(row.party_size)}`, {
          description: formatReservationWhen(row.starts_at),
          action: {
            label: 'Ver',
            onClick: () => router.push('/dashboard/reservas'),
          },
        })
      } else if (
        payload.eventType === 'UPDATE' &&
        row?.status === 'cancelled' &&
        previous?.status !== 'cancelled'
      ) {
        playSoundEvent('reservation_cancelled')
        toast('Un cliente canceló su reserva', {
          description: formatReservationWhen(row.starts_at),
        })
      }
      router.refresh()
    },
  })

  return null
}
