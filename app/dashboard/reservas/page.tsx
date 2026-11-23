import { CalendarClockIcon, CheckIcon } from 'lucide-react'
import type { Metadata } from 'next'
import Link from 'next/link'
import {
  ReservationCard,
  type StoreReservation,
} from '@/components/dashboard/reservations/reservation-card'
import { ReservationSettingsForm } from '@/components/dashboard/reservations/reservation-settings-form'
import { Button } from '@/components/ui/button'
import { EmptyState } from '@/components/ui/empty-state'
import { requireActiveStoreRow } from '@/lib/dashboard/store-context'
import { planHas, planOfStore } from '@/lib/plans'
import {
  daySummary,
  groupByServiceDate,
  guestHistory,
} from '@/lib/reservations/board'
import {
  formatReservationDay,
  formatReservationLongDay,
  partyLabel,
} from '@/lib/reservations/format'
import type { ReservationStatus } from '@/lib/reservations/vocabulary'
import { bogotaClock, parseSchedule } from '@/lib/store/hours'
import { createClient } from '@/lib/supabase/server'
import { throwOnQueryError } from '@/lib/supabase/query-error'
import type { ReservationSettingsValues } from '@/lib/validations/reservations'

export const metadata: Metadata = { title: 'Reservas' }
export const dynamic = 'force-dynamic'

const COLUMNS =
  'id, code, status, starts_at, service_date, party_size, customer_id, contact_name, contact_phone, occasion, notes, decline_reason, cancel_reason, seated_at, no_show_at'

const DEFAULTS: ReservationSettingsValues = {
  enabled: false,
  slotMinutes: 30,
  coversPerSlot: 20,
  maxPartySize: 8,
  minLeadMinutes: 120,
  maxDaysAhead: 30,
  durationMinutes: 90,
  policyText: '',
  blockedDates: [],
}

const BENEFITS = [
  'El botón "Reservar mesa" en tu tienda y en el directorio de reservas de Cerquita',
  'Te suena y te llega una notificación con cada reserva nueva',
  'Confirmas o rechazas con un toque y el cliente se entera al instante',
  'Sabes cuántas personas llegan hoy y quién suele no llegar',
]

export default async function DashboardReservationsPage() {
  const { store } = await requireActiveStoreRow('/dashboard/reservas')
  const supabase = await createClient()
  const included = planHas(planOfStore(store), 'reservations')
  const now = new Date()
  const today = bogotaClock(now).date

  const [
    { data: settings, error: settingsError },
    { data: upcoming, error: upcomingError },
    { data: past, error: pastError },
    { data: outcomes, error: outcomesError },
  ] = await Promise.all([
    supabase
      .from('reservation_settings')
      .select('*')
      .eq('store_id', store.id)
      .maybeSingle(),
    supabase
      .from('reservations')
      .select(COLUMNS)
      .eq('store_id', store.id)
      .gte('service_date', today)
      .order('starts_at', { ascending: true })
      .limit(300),
    supabase
      .from('reservations')
      .select(COLUMNS)
      .eq('store_id', store.id)
      .lt('service_date', today)
      .order('starts_at', { ascending: false })
      .limit(50),
    supabase
      .from('reservations')
      .select('customer_id, status')
      .eq('store_id', store.id)
      .in('status', ['seated', 'no_show'])
      .limit(2000),
  ])
  throwOnQueryError(settingsError, 'reservation settings')
  throwOnQueryError(upcomingError, 'upcoming reservations')
  throwOnQueryError(pastError, 'past reservations')
  throwOnQueryError(outcomesError, 'reservation outcomes')

  const asStore = (rows: typeof upcoming) =>
    (rows ?? []).map((row) => ({
      ...row,
      status: row.status as ReservationStatus,
    })) as StoreReservation[]
  const rows = asStore(upcoming)
  const history = asStore(past)
  const guests = Object.fromEntries(
    guestHistory(
      (outcomes ?? []).map((row) => ({
        customer_id: row.customer_id,
        status: row.status as ReservationStatus,
      })),
    ),
  )

  const initial: ReservationSettingsValues = settings
    ? {
        enabled: settings.enabled,
        slotMinutes: settings.slot_minutes,
        coversPerSlot: settings.covers_per_slot,
        maxPartySize: settings.max_party_size,
        minLeadMinutes: settings.min_lead_minutes,
        maxDaysAhead: settings.max_days_ahead,
        durationMinutes: settings.duration_minutes,
        policyText: settings.policy_text,
        blockedDates: settings.blocked_dates,
      }
    : DEFAULTS
  const hasSchedule = Object.keys(parseSchedule(store.schedule)).length > 0
  const pendingRows = rows.filter(
    (row) => row.status === 'pending' && new Date(row.starts_at) > now,
  )
  const todayRows = rows.filter((row) => row.service_date === today)
  const later = groupByServiceDate(
    rows.filter((row) => row.service_date > today),
  )
  const summary = daySummary(todayRows)
  const nowIso = now.toISOString()

  return (
    <div className="mx-auto max-w-5xl space-y-6">
      <header className="flex flex-wrap items-end justify-between gap-4">
        <div className="space-y-1">
          <h1 className="font-display text-3xl font-semibold tracking-tight sm:text-4xl">
            Reservas
          </h1>
          <p className="text-muted-foreground text-sm">
            {initial.enabled
              ? `Hoy: ${summary.reservations} reserva${summary.reservations === 1 ? '' : 's'} · ${partyLabel(summary.covers)}`
              : 'Recibe reservas de mesa y confírmalas desde aquí.'}
          </p>
        </div>
        {included || initial.enabled ? (
          <ReservationSettingsForm
            initial={initial}
            included={included}
            defaultOpen={!settings && included && hasSchedule}
          />
        ) : null}
      </header>

      {!included ? (
        <section
          aria-labelledby="reservas-plan"
          className="rounded-card bg-card shadow-1 p-card space-y-4"
        >
          <div className="flex items-start gap-3">
            <CalendarClockIcon
              aria-hidden="true"
              className="text-primary mt-1 size-6 shrink-0"
            />
            <div className="space-y-1">
              <h2
                id="reservas-plan"
                className="font-display text-xl font-semibold"
              >
                Llena tus mesas con reservas
              </h2>
              <p className="text-muted-foreground text-sm">
                Las reservas están incluidas en los planes Mediano y VIP.
              </p>
            </div>
          </div>
          <ul className="space-y-2 text-sm">
            {BENEFITS.map((benefit) => (
              <li key={benefit} className="flex gap-2">
                <CheckIcon
                  aria-hidden="true"
                  className="text-success mt-0.5 size-4 shrink-0"
                />
                {benefit}
              </li>
            ))}
          </ul>
          <Button asChild className="rounded-pill">
            <Link href="/dashboard/payouts">Ver planes</Link>
          </Button>
        </section>
      ) : null}

      {included && !hasSchedule ? (
        <p
          role="note"
          className="rounded-card border-accent/40 bg-accent/10 border p-4 text-sm"
        >
          Configura tu horario de atención primero: las horas de reserva se
          ofrecen dentro de él.{' '}
          <Link
            href="/dashboard/store"
            className="text-primary-on-tint font-medium underline underline-offset-2"
          >
            Ir a mi tienda
          </Link>
        </p>
      ) : null}

      {pendingRows.length > 0 ? (
        <section aria-labelledby="por-confirmar" className="space-y-3">
          <h2 id="por-confirmar" className="font-display text-xl font-semibold">
            Por confirmar ({pendingRows.length})
          </h2>
          <div className="grid gap-3 md:grid-cols-2">
            {pendingRows.map((row) => (
              <ReservationCard
                key={row.id}
                reservation={row}
                history={guests[row.customer_id]}
                nowIso={nowIso}
              />
            ))}
          </div>
        </section>
      ) : null}

      <section aria-labelledby="hoy" className="space-y-3">
        <h2 id="hoy" className="font-display text-xl font-semibold">
          Hoy
        </h2>
        {todayRows.length > 0 ? (
          <div className="grid gap-3 md:grid-cols-2">
            {todayRows
              .filter((row) => !pendingRows.includes(row))
              .map((row) => (
                <ReservationCard
                  key={row.id}
                  reservation={row}
                  history={guests[row.customer_id]}
                  nowIso={nowIso}
                />
              ))}
          </div>
        ) : (
          <EmptyState
            illustration="table"
            title="Sin reservas para hoy"
            description={
              initial.enabled
                ? 'Cuando alguien reserve, te sonará y aparecerá aquí.'
                : 'Activa las reservas para que tus clientes puedan apartar mesa.'
            }
          />
        )}
      </section>

      {later.length > 0 ? (
        <section aria-labelledby="proximas" className="space-y-4">
          <h2 id="proximas" className="font-display text-xl font-semibold">
            Próximas
          </h2>
          {later.map((day) => {
            const daily = daySummary(day.reservations)
            return (
              <div key={day.date} className="space-y-3">
                <h3 className="text-muted-foreground text-sm font-semibold">
                  {formatReservationDay(day.date, now)} ·{' '}
                  {formatReservationLongDay(day.date)} · {daily.reservations}{' '}
                  reserva
                  {daily.reservations === 1 ? '' : 's'} ·{' '}
                  {partyLabel(daily.covers)}
                </h3>
                <div className="grid gap-3 md:grid-cols-2">
                  {day.reservations
                    .filter((row) => !pendingRows.includes(row))
                    .map((row) => (
                      <ReservationCard
                        key={row.id}
                        reservation={row}
                        history={guests[row.customer_id]}
                        nowIso={nowIso}
                      />
                    ))}
                </div>
              </div>
            )
          })}
        </section>
      ) : null}

      {history.length > 0 ? (
        <details className="rounded-card bg-card shadow-1 group">
          <summary className="cursor-pointer p-4 font-medium">
            Historial reciente ({history.length})
          </summary>
          <div className="grid gap-3 p-4 pt-0 md:grid-cols-2">
            {history.map((row) => (
              <ReservationCard
                key={row.id}
                reservation={row}
                history={guests[row.customer_id]}
                nowIso={nowIso}
              />
            ))}
          </div>
        </details>
      ) : null}
    </div>
  )
}
