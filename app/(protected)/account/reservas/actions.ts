'use server'

import { revalidatePath } from 'next/cache'
import { after } from 'next/server'
import { isUuid } from '@/lib/dashboard/active-store'
import { logger } from '@/lib/log/logger'
import { reservationCancelledMessage } from '@/lib/push/messages'
import { sendPushToStoreOwner } from '@/lib/push/send'
import { formatReservationWhen } from '@/lib/reservations/format'
import { checkTransition } from '@/lib/reservations/transitions'
import type { ReservationStatus } from '@/lib/reservations/vocabulary'
import { createAdminClient } from '@/lib/supabase/admin'
import { createClient } from '@/lib/supabase/server'

export type CancelReservationResult =
  { ok: true } | { ok: false; error: string }

/**
 * The customer cancels their own reservation, before its time. A
 * compare-and-set on the status read, so a store confirming at the same
 * moment and this cancellation cannot overwrite each other.
 */
export async function cancelMyReservation(
  reservationId: string,
): Promise<CancelReservationResult> {
  if (!isUuid(reservationId)) return { ok: false, error: 'Reserva inválida.' }

  const supabase = await createClient()
  const {
    data: { user },
  } = await supabase.auth.getUser()
  if (!user)
    return { ok: false, error: 'Tu sesión expiró. Inicia sesión de nuevo.' }

  const admin = createAdminClient()
  const { data: row, error: readError } = await admin
    .from('reservations')
    .select('id, store_id, status, starts_at, party_size')
    .eq('id', reservationId)
    .eq('customer_id', user.id)
    .maybeSingle()
  if (readError) {
    logger.error('reservation.cancel_read_failed', { reservationId }, readError)
    return { ok: false, error: 'No pudimos cancelar. Inténtalo de nuevo.' }
  }
  if (!row) return { ok: false, error: 'No encontramos esa reserva.' }

  const from = row.status as ReservationStatus
  const allowed = checkTransition({
    from,
    to: 'cancelled',
    actor: 'customer',
    startsAt: new Date(row.starts_at),
    statusChangedAt: null,
    now: new Date(),
  })
  if (!allowed.ok) return allowed

  const { data: updated, error } = await admin
    .from('reservations')
    .update({ status: 'cancelled', cancelled_by: 'customer' })
    .eq('id', row.id)
    .eq('customer_id', user.id)
    .eq('status', from)
    .select('id')
  if (error) {
    logger.error('reservation.cancel_failed', { reservationId }, error)
    return { ok: false, error: 'No pudimos cancelar. Inténtalo de nuevo.' }
  }
  if (!updated || updated.length === 0) {
    return {
      ok: false,
      error: 'La reserva cambió mientras tanto. Actualiza la página.',
    }
  }

  const message = reservationCancelledMessage({
    partySize: row.party_size,
    when: formatReservationWhen(row.starts_at),
  })
  after(() => sendPushToStoreOwner(row.store_id, message))

  revalidatePath('/account/reservas')
  revalidatePath('/account')
  return { ok: true }
}
