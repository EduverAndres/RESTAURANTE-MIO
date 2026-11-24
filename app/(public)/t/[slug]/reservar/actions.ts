'use server'

import { revalidatePath } from 'next/cache'
import { headers } from 'next/headers'
import { after } from 'next/server'
import { clientIp } from '@/lib/http/client-ip'
import { logger } from '@/lib/log/logger'
import { fromPush } from '@/lib/notifications/messages'
import { notify } from '@/lib/notifications/send'
import { newReservationMessage } from '@/lib/push/messages'
import {
  RESERVATION_CREATE_IP_POLICY,
  RESERVATION_CREATE_POLICY,
  rateLimitIdentifier,
} from '@/lib/rate-limit/policy'
import {
  enforceRateLimit,
  postgresRateLimitStore,
} from '@/lib/rate-limit/store'
import { formatReservationWhen } from '@/lib/reservations/format'
import { isReservable, toReservationConfig } from '@/lib/reservations/server'
import { checkStart, loadFromRows } from '@/lib/reservations/slots'
import { HOLDING_STATUSES } from '@/lib/reservations/vocabulary'
import { createAdminClient } from '@/lib/supabase/admin'
import { createClient } from '@/lib/supabase/server'
import {
  reservationRequestSchema,
  type ReservationRequestInput,
} from '@/lib/validations/reservations'

export type CreateReservationResult =
  | { ok: true; reservationId: string; code: string }
  | {
      ok: false
      error: string
      field?: string
      reason?: 'auth' | 'full'
    }

/** A customer may hold this many upcoming reservations across all stores. */
const MAX_ACTIVE_PER_CUSTOMER = 5

const OUTCOME_MESSAGES: Record<string, string> = {
  disabled: 'Este restaurante no está recibiendo reservas en este momento.',
  closed: 'El restaurante no recibe reservas ese día. Prueba otra fecha.',
  too_large:
    'El grupo es más grande de lo que el restaurante acepta en línea. Escríbele directamente.',
  too_soon: 'Esa hora ya está muy cerca. Elige una más adelante.',
  too_far: 'Esa fecha todavía no está abierta para reservas.',
  limit:
    'Ya tienes varias reservas próximas. Cancela alguna antes de hacer otra.',
  duplicate:
    'Ya tienes una reserva en este restaurante ese día. Puedes verla en Mis reservas.',
  full: 'Esa hora se acaba de llenar. Elige otra.',
}

/**
 * Books a table. The slot grid and opening hours are validated here with the
 * same code that drew them in the browser (`checkStart`); everything that can
 * race is validated again, atomically, by `public.create_reservation`.
 */
export async function createReservation(
  input: ReservationRequestInput,
): Promise<CreateReservationResult> {
  const parsed = reservationRequestSchema.safeParse(input)
  if (!parsed.success) {
    const issue = parsed.error.issues[0]
    return {
      ok: false,
      error: issue?.message ?? 'Revisa los datos de la reserva.',
      field: String(issue?.path[0] ?? ''),
    }
  }
  const values = parsed.data

  const supabase = await createClient()
  const {
    data: { user },
  } = await supabase.auth.getUser()
  if (!user) {
    return {
      ok: false,
      error: 'Inicia sesión para reservar.',
      reason: 'auth',
    }
  }

  const admin = createAdminClient()
  const ip = clientIp(await headers())
  const limit = await enforceRateLimit(postgresRateLimitStore(admin), [
    {
      policy: RESERVATION_CREATE_POLICY,
      identifier: rateLimitIdentifier('user', user.id),
    },
    ...(ip
      ? [
          {
            policy: RESERVATION_CREATE_IP_POLICY,
            identifier: rateLimitIdentifier('ip', ip),
          },
        ]
      : []),
  ])
  if (!limit.allowed) {
    logger.warn('reservation.rate_limited', { userId: user.id })
    return {
      ok: false,
      error:
        'Hiciste muchas solicitudes seguidas. Espera un rato e inténtalo de nuevo.',
    }
  }

  const [{ data: store }, { data: settings }] = await Promise.all([
    admin
      .from('stores')
      .select('id, slug, name, status, plan, founder_until, schedule')
      .eq('id', values.storeId)
      .maybeSingle(),
    admin
      .from('reservation_settings')
      .select('*')
      .eq('store_id', values.storeId)
      .maybeSingle(),
  ])
  if (!store || !settings || !isReservable(store, settings)) {
    return { ok: false, error: OUTCOME_MESSAGES.disabled }
  }

  const config = toReservationConfig(settings)
  const startsAt = new Date(values.startsAt)
  const slotEnd = new Date(startsAt.getTime() + config.slotMinutes * 60_000)
  const { data: holding, error: holdingError } = await admin
    .from('reservations')
    .select('starts_at, party_size')
    .eq('store_id', store.id)
    .in('status', [...HOLDING_STATUSES])
    .gte('starts_at', startsAt.toISOString())
    .lt('starts_at', slotEnd.toISOString())
  if (holdingError) {
    logger.error('reservation.load_failed', { storeId: store.id }, holdingError)
    return { ok: false, error: 'No pudimos reservar. Inténtalo de nuevo.' }
  }

  const check = checkStart({
    schedule: store.schedule,
    config,
    load: loadFromRows(holding ?? []),
    partySize: values.partySize,
    now: new Date(),
    serviceDate: values.serviceDate,
    startsAt,
  })
  if (!check.ok) return { ok: false, error: check.error, reason: 'full' }

  const { data, error } = await admin.rpc('create_reservation', {
    p_store_id: store.id,
    p_customer_id: user.id,
    p_starts_at: startsAt.toISOString(),
    p_service_date: values.serviceDate,
    p_party_size: values.partySize,
    p_contact_name: values.contactName,
    p_contact_phone: values.contactPhone,
    // Null is a valid argument; generated types mark every one as required.
    p_occasion: (values.occasion ?? '') as string,
    p_notes: (values.notes ?? '') as string,
    p_max_active: MAX_ACTIVE_PER_CUSTOMER,
  })
  const row = Array.isArray(data) ? data[0] : data
  if (error || !row) {
    logger.error('reservation.create_failed', { storeId: store.id }, error)
    return { ok: false, error: 'No pudimos reservar. Inténtalo de nuevo.' }
  }
  if (row.outcome !== 'ok' || !row.reservation_id) {
    return {
      ok: false,
      error: OUTCOME_MESSAGES[row.outcome] ?? 'No pudimos reservar.',
      ...(row.outcome === 'full' ? { reason: 'full' as const } : {}),
    }
  }

  const message = newReservationMessage({
    partySize: values.partySize,
    when: formatReservationWhen(startsAt),
    storeName: store.name,
  })
  after(() =>
    notify({ storeOwner: store.id }, fromPush('reservation_new', message)),
  )

  revalidatePath('/account/reservas')
  revalidatePath('/dashboard/reservas')
  revalidatePath(`/t/${store.slug}/reservar`)
  return { ok: true, reservationId: row.reservation_id, code: row.code }
}
