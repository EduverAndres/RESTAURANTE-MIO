'use server'

import { revalidatePath } from 'next/cache'
import { after } from 'next/server'
import { requireActiveStoreRow } from '@/lib/dashboard/store-context'
import { logger } from '@/lib/log/logger'
import { planHas, planOfStore } from '@/lib/plans'
import { fromPush } from '@/lib/notifications/messages'
import { notify } from '@/lib/notifications/send'
import { reservationStatusMessage } from '@/lib/push/messages'
import { formatReservationWhen } from '@/lib/reservations/format'
import { actionTarget, checkTransition } from '@/lib/reservations/transitions'
import type { ReservationStatus } from '@/lib/reservations/vocabulary'
import { createAdminClient } from '@/lib/supabase/admin'
import {
  reservationActionSchema,
  reservationSettingsSchema,
  type ReservationActionInput,
  type ReservationSettingsInput,
} from '@/lib/validations/reservations'

export type ReservationActionResult =
  { ok: true } | { ok: false; error: string }

const GENERIC = 'No pudimos guardar el cambio. Inténtalo de nuevo.'

/** When the reservation entered its current status, for the undo windows. */
function statusChangedAt(row: {
  status: string
  seated_at: string | null
  no_show_at: string | null
}): Date | null {
  if (row.status === 'seated' && row.seated_at) return new Date(row.seated_at)
  if (row.status === 'no_show' && row.no_show_at)
    return new Date(row.no_show_at)
  return null
}

/**
 * Saves how the store takes reservations. Turning them on needs a plan that
 * includes reservations; turning them off never does, so a store that moves
 * down a plan can still close its book. Written with the service role, after
 * proving the store is the caller's (`requireActiveStoreRow`).
 */
export async function saveReservationSettings(
  input: ReservationSettingsInput,
): Promise<ReservationActionResult> {
  const parsed = reservationSettingsSchema.safeParse(input)
  if (!parsed.success) {
    return {
      ok: false,
      error: parsed.error.issues[0]?.message ?? 'Revisa la configuración.',
    }
  }
  const values = parsed.data
  const { store } = await requireActiveStoreRow('/dashboard/reservas')
  if (values.enabled && !planHas(planOfStore(store), 'reservations')) {
    return {
      ok: false,
      error: 'Las reservas están incluidas en los planes Mediano y VIP.',
    }
  }

  const { error } = await createAdminClient()
    .from('reservation_settings')
    .upsert(
      {
        store_id: store.id,
        enabled: values.enabled,
        slot_minutes: values.slotMinutes,
        covers_per_slot: values.coversPerSlot,
        max_party_size: values.maxPartySize,
        min_lead_minutes: values.minLeadMinutes,
        max_days_ahead: values.maxDaysAhead,
        duration_minutes: values.durationMinutes,
        policy_text: values.policyText,
        blocked_dates: [...new Set(values.blockedDates)].sort(),
      },
      { onConflict: 'store_id' },
    )
  if (error) {
    logger.error('reservations.settings_failed', { storeId: store.id }, error)
    return { ok: false, error: GENERIC }
  }

  revalidatePath('/dashboard/reservas')
  revalidatePath(`/t/${store.slug}`)
  revalidatePath(`/t/${store.slug}/reservar`)
  revalidatePath('/reservas')
  return { ok: true }
}

/**
 * Confirm, decline, seat, no-show, cancel or undo one of the store's
 * reservations. The time rules are `checkTransition`'s; the write is a
 * compare-and-set on the status read, so a customer cancelling at the same
 * moment wins cleanly instead of being overwritten.
 */
export async function actOnReservation(
  input: ReservationActionInput,
): Promise<ReservationActionResult> {
  const parsed = reservationActionSchema.safeParse(input)
  if (!parsed.success) {
    return {
      ok: false,
      error: parsed.error.issues[0]?.message ?? 'Datos inválidos.',
    }
  }
  const { reservationId, action, reason } = parsed.data
  const { store } = await requireActiveStoreRow('/dashboard/reservas')
  const admin = createAdminClient()

  const { data: row, error: readError } = await admin
    .from('reservations')
    .select(
      'id, store_id, customer_id, status, starts_at, seated_at, no_show_at',
    )
    .eq('id', reservationId)
    .eq('store_id', store.id)
    .maybeSingle()
  if (readError) {
    logger.error('reservations.read_failed', { reservationId }, readError)
    return { ok: false, error: GENERIC }
  }
  if (!row) return { ok: false, error: 'No encontramos esa reserva.' }

  const from = row.status as ReservationStatus
  const to = actionTarget(action)
  const allowed = checkTransition({
    from,
    to,
    actor: 'store',
    startsAt: new Date(row.starts_at),
    statusChangedAt: statusChangedAt(row),
    now: new Date(),
  })
  if (!allowed.ok) return allowed

  const { data: updated, error } = await admin
    .from('reservations')
    .update({
      status: to,
      ...(to === 'declined' ? { decline_reason: reason } : {}),
      ...(to === 'cancelled'
        ? { cancel_reason: reason, cancelled_by: 'store' }
        : {}),
    })
    .eq('id', row.id)
    .eq('store_id', store.id)
    .eq('status', from)
    .select('id')
  if (error) {
    logger.error('reservations.update_failed', { reservationId, to }, error)
    return { ok: false, error: GENERIC }
  }
  if (!updated || updated.length === 0) {
    return {
      ok: false,
      error: 'La reserva cambió mientras tanto. Actualizamos la lista.',
    }
  }

  if (to === 'confirmed' || to === 'declined' || to === 'cancelled') {
    if (from !== 'seated') {
      const message = reservationStatusMessage(to, {
        id: row.id,
        storeName: store.name,
        when: formatReservationWhen(row.starts_at),
        reason,
      })
      after(() =>
        notify(
          { userIds: [row.customer_id] },
          fromPush('reservation_updated', message),
        ),
      )
    }
  }

  revalidatePath('/dashboard/reservas')
  revalidatePath('/account/reservas')
  return { ok: true }
}
