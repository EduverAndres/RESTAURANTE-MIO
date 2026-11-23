import {
  CalendarDaysIcon,
  MapPinIcon,
  MessageCircleIcon,
  UsersIcon,
} from 'lucide-react'
import type { Metadata } from 'next'
import Link from 'next/link'
import { StatusBadge } from '@/components/orders/order-status-badge'
import { AccountReservationsLive } from '@/components/reservations/account-reservations-live'
import { CancelReservationButton } from '@/components/reservations/cancel-reservation-button'
import { Button } from '@/components/ui/button'
import { EmptyState } from '@/components/ui/empty-state'
import { requireUser } from '@/lib/auth'
import { buildWhatsAppUrl } from '@/lib/orders/whatsapp'
import { formatReservationWhen, partyLabel } from '@/lib/reservations/format'
import {
  customerCanCancel,
  displayStatus,
} from '@/lib/reservations/transitions'
import {
  RESERVATION_STATUS_LABELS,
  RESERVATION_STATUS_TONES,
  type ReservationStatus,
} from '@/lib/reservations/vocabulary'
import { createClient } from '@/lib/supabase/server'
import { throwOnQueryError } from '@/lib/supabase/query-error'

export const metadata: Metadata = { title: 'Mis reservas' }
export const dynamic = 'force-dynamic'

const EXPLAIN: Record<ReservationStatus | 'expired', string> = {
  pending: 'Esperando que el restaurante confirme. Te avisamos al instante.',
  confirmed: 'Tu mesa está confirmada. ¡Te esperan!',
  declined: 'El restaurante no pudo confirmar esta reserva.',
  cancelled: 'Esta reserva fue cancelada.',
  seated: '¡Gracias por venir!',
  no_show: 'El restaurante marcó que no llegaste.',
  expired: 'El restaurante no respondió a tiempo.',
}

export default async function MyReservationsPage() {
  const { user } = await requireUser('/account/reservas')
  const supabase = await createClient()
  const { data, error } = await supabase
    .from('reservations')
    .select(
      'id, code, status, starts_at, party_size, decline_reason, cancel_reason, cancelled_by, stores(name, slug, address, whatsapp_phone)',
    )
    .eq('customer_id', user.id)
    .order('starts_at', { ascending: false })
    .limit(60)
  throwOnQueryError(error, 'my reservations')

  const now = new Date()
  const rows = (data ?? []).map((row) => ({
    ...row,
    status: row.status as ReservationStatus,
  }))
  const upcoming = rows
    .filter(
      (row) =>
        new Date(row.starts_at) > now &&
        (row.status === 'pending' || row.status === 'confirmed'),
    )
    .reverse()
  const past = rows.filter((row) => !upcoming.includes(row))

  const card = (row: (typeof rows)[number]) => {
    const startsAt = new Date(row.starts_at)
    const status = displayStatus({ status: row.status, startsAt }, now)
    const store = row.stores
    const whatsapp = store?.whatsapp_phone
      ? buildWhatsAppUrl(
          store.whatsapp_phone,
          `Hola, les escribo por mi reserva ${row.code}.`,
        )
      : null
    const reason = row.decline_reason ?? row.cancel_reason
    return (
      <li
        key={row.id}
        id={`r-${row.id}`}
        className="rounded-card bg-card shadow-1 scroll-mt-24 space-y-3 p-4"
      >
        <div className="flex flex-wrap items-start justify-between gap-3">
          <div className="space-y-1">
            {store ? (
              <Link
                href={`/t/${store.slug}`}
                className="font-display text-lg font-semibold underline-offset-2 hover:underline"
              >
                {store.name}
              </Link>
            ) : (
              <p className="font-display text-lg font-semibold">Restaurante</p>
            )}
            <p className="flex flex-wrap items-center gap-x-3 gap-y-1 text-sm">
              <span className="inline-flex items-center gap-1">
                <CalendarDaysIcon aria-hidden="true" className="size-4" />
                {formatReservationWhen(startsAt)}
              </span>
              <span className="inline-flex items-center gap-1">
                <UsersIcon aria-hidden="true" className="size-4" />
                {partyLabel(row.party_size)}
              </span>
            </p>
          </div>
          <StatusBadge
            label={
              status === 'expired'
                ? 'Sin respuesta'
                : RESERVATION_STATUS_LABELS[status]
            }
            tone={
              status === 'expired'
                ? 'neutral'
                : RESERVATION_STATUS_TONES[status]
            }
          />
        </div>
        <p className="text-muted-foreground text-sm">
          {EXPLAIN[status]}
          {reason && row.cancelled_by !== 'customer'
            ? ` Motivo: ${reason}`
            : ''}
        </p>
        <p className="text-muted-foreground text-xs">
          Código <span className="font-mono">{row.code}</span>
        </p>
        <div className="flex flex-wrap gap-2">
          {customerCanCancel({ status: row.status, startsAt }, now) ? (
            <CancelReservationButton
              reservationId={row.id}
              storeName={store?.name ?? 'El restaurante'}
            />
          ) : null}
          {store?.address && status !== 'cancelled' && status !== 'declined' ? (
            <Button
              asChild
              variant="ghost"
              size="sm"
              className="rounded-pill h-10"
            >
              <a
                href={`https://www.google.com/maps/search/?api=1&query=${encodeURIComponent(`${store.name} ${store.address}`)}`}
                target="_blank"
                rel="noopener noreferrer"
              >
                <MapPinIcon aria-hidden="true" data-icon="inline-start" />
                Cómo llegar
              </a>
            </Button>
          ) : null}
          {whatsapp ? (
            <Button
              asChild
              variant="ghost"
              size="sm"
              className="rounded-pill h-10"
            >
              <a href={whatsapp} target="_blank" rel="noopener noreferrer">
                <MessageCircleIcon
                  aria-hidden="true"
                  data-icon="inline-start"
                />
                Escribir al restaurante
              </a>
            </Button>
          ) : null}
        </div>
      </li>
    )
  }

  return (
    <div className="container-page mx-auto max-w-3xl space-y-8 py-8">
      <AccountReservationsLive userId={user.id} />
      <header className="space-y-1">
        <h1 className="font-display text-3xl font-semibold tracking-tight sm:text-4xl">
          Mis reservas
        </h1>
        <p className="text-muted-foreground text-sm">
          Tus mesas reservadas. Cuando el restaurante responde, se actualiza
          aquí.
        </p>
      </header>

      <section aria-labelledby="proximas-title" className="space-y-3">
        <h2 id="proximas-title" className="font-display text-xl font-semibold">
          Próximas
        </h2>
        {upcoming.length > 0 ? (
          <ul className="space-y-3">{upcoming.map(card)}</ul>
        ) : (
          <EmptyState
            illustration="table"
            title="No tienes reservas próximas"
            description="Reserva tu mesa en los restaurantes que lo permiten."
            action={
              <Button asChild className="rounded-pill">
                <Link href="/reservas">Ver restaurantes con reservas</Link>
              </Button>
            }
          />
        )}
      </section>

      {past.length > 0 ? (
        <section aria-labelledby="anteriores-title" className="space-y-3">
          <h2
            id="anteriores-title"
            className="font-display text-xl font-semibold"
          >
            Anteriores
          </h2>
          <ul className="space-y-3">{past.map(card)}</ul>
        </section>
      ) : null}
    </div>
  )
}
