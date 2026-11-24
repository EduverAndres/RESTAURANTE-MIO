'use client'

import {
  CalendarCheckIcon,
  CalendarPlusIcon,
  CalendarXIcon,
  CheckIcon,
} from 'lucide-react'
import Link from 'next/link'
import { useCallback, useMemo, useState, type RefObject } from 'react'
import {
  useBroadcastChannel,
  useRealtimeChannel,
} from '@/components/providers/realtime-provider'
import { Button } from '@/components/ui/button'
import { formatReservationWhen, partyLabel } from '@/lib/reservations/format'
import { buildIcs } from '@/lib/reservations/ics'
import { requestStatusCopy } from '@/lib/reservations/request-status'
import {
  RESERVATION_STATUSES,
  type ReservationStatus,
} from '@/lib/reservations/vocabulary'
import { createClient } from '@/lib/supabase/client'
import { cn } from '@/lib/utils'

interface Props {
  reservation: { id: string; code: string }
  userId: string
  store: { name: string; address: string | null }
  party: number
  startsAt: string
  durationMinutes: number
  headingRef: RefObject<HTMLHeadingElement | null>
  /** Back to the form, to pick another time once this one no longer stands. */
  onRebook: () => void
}

interface Answer {
  status: ReservationStatus
  reason: string | null
  cancelledBy: string | null
}

const TONE_CLASSES = {
  pending: 'bg-success/15 text-success',
  success: 'bg-success/15 text-success',
  danger: 'bg-destructive/12 text-destructive',
} as const

function isStatus(value: unknown): value is ReservationStatus {
  return (RESERVATION_STATUSES as readonly unknown[]).includes(value)
}

/**
 * The card the customer sees right after asking for a table. It follows the
 * restaurant's answer live: the database broadcasts a notification on the
 * customer's private topic the moment the store confirms, declines or
 * cancels, and the card re-reads the reservation (its status and reason come
 * from the row, never from the message). Row changes and a return to the tab
 * are backups, so a missed message never leaves "Solicitud enviada" stale.
 */
export function RequestStatusCard({
  reservation,
  userId,
  store,
  party,
  startsAt,
  durationMinutes,
  headingRef,
  onRebook,
}: Props) {
  const supabase = useMemo(() => createClient(), [])
  const [answer, setAnswer] = useState<Answer>({
    status: 'pending',
    reason: null,
    cancelledBy: null,
  })

  const reload = useCallback(async () => {
    const { data, error } = await supabase
      .from('reservations')
      .select('status, decline_reason, cancel_reason, cancelled_by')
      .eq('id', reservation.id)
      .maybeSingle()
    if (error || !data || !isStatus(data.status)) return
    setAnswer({
      status: data.status,
      reason: data.decline_reason ?? data.cancel_reason,
      cancelledBy: data.cancelled_by,
    })
  }, [supabase, reservation.id])

  useBroadcastChannel({
    topic: `user:${userId}`,
    event: 'notification',
    onMessage: (payload) => {
      if (String(payload.kind ?? '').startsWith('reservation_')) void reload()
    },
    onResync: () => void reload(),
  })
  useRealtimeChannel({
    name: `customer-reservations-${userId}`,
    table: 'reservations',
    event: 'UPDATE',
    filter: `customer_id=eq.${userId}`,
    onEvent: () => void reload(),
    onResync: () => void reload(),
  })

  const when = formatReservationWhen(startsAt)
  const copy = requestStatusCopy(answer.status, {
    storeName: store.name,
    when,
    party: partyLabel(party),
    reason: answer.reason,
    cancelledBy: answer.cancelledBy,
  })
  const Icon =
    answer.status === 'pending'
      ? CheckIcon
      : copy.tone === 'danger'
        ? CalendarXIcon
        : CalendarCheckIcon
  const ics = copy.showCalendar
    ? buildIcs({
        uid: reservation.id,
        title: `Reserva en ${store.name} · ${partyLabel(party)}`,
        start: new Date(startsAt),
        durationMinutes,
        location: store.address,
        description: `Código ${reservation.code}`,
      })
    : null

  return (
    <section
      aria-labelledby="reserva-lista"
      data-status={answer.status}
      className="rounded-card bg-card shadow-2 p-card space-y-5 text-center"
    >
      {/* Keyed by status, so the pop plays again when the answer arrives. */}
      <div
        key={answer.status}
        className={cn(
          'mx-auto flex size-16 animate-[check-pop_420ms_var(--ease-out-soft)_both] items-center justify-center rounded-full',
          TONE_CLASSES[copy.tone],
        )}
      >
        <Icon aria-hidden="true" className="size-8" />
      </div>
      <div aria-live="polite" className="space-y-2">
        <h2
          id="reserva-lista"
          ref={headingRef}
          tabIndex={-1}
          className="font-display text-2xl font-semibold outline-none"
        >
          {copy.title}
        </h2>
        <p className="text-muted-foreground text-pretty">{copy.body}</p>
        <p className="text-sm">
          Código de reserva:{' '}
          <span className="font-mono font-semibold">{reservation.code}</span>
        </p>
      </div>
      <div className="flex flex-col justify-center gap-2 sm:flex-row">
        {copy.canRebook ? (
          <Button className="rounded-pill h-11" onClick={onRebook}>
            Elegir otra hora
          </Button>
        ) : null}
        <Button
          asChild
          variant={copy.canRebook ? 'outline' : 'default'}
          className="rounded-pill h-11"
        >
          <Link href="/account/reservas">Ver mis reservas</Link>
        </Button>
        {ics ? (
          <Button asChild variant="outline" className="rounded-pill h-11">
            <a
              href={`data:text/calendar;charset=utf-8,${encodeURIComponent(ics)}`}
              download={`reserva-${reservation.code}.ics`}
            >
              <CalendarPlusIcon aria-hidden="true" data-icon="inline-start" />
              Agregar al calendario
            </a>
          </Button>
        ) : null}
      </div>
    </section>
  )
}
