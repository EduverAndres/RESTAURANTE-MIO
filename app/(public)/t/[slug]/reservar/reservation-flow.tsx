'use client'

import { LoaderCircleIcon, MinusIcon, PlusIcon } from 'lucide-react'
import Link from 'next/link'
import {
  useMemo,
  useRef,
  useState,
  useTransition,
  type KeyboardEvent,
} from 'react'
import { toast } from 'sonner'
import { createReservation } from './actions'
import { RequestStatusCard } from './request-status-card'
import { FieldError } from '@/components/forms/field-error'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { Textarea } from '@/components/ui/textarea'
import {
  formatReservationDay,
  formatReservationWhen,
  partyLabel,
} from '@/lib/reservations/format'
import {
  bookableDates,
  nextAvailableDates,
  slotsFor,
  type ReservationConfig,
  type Slot,
  type SlotLoad,
} from '@/lib/reservations/slots'
import {
  OCCASION_LABELS,
  RESERVATION_OCCASIONS,
  type ReservationOccasion,
} from '@/lib/reservations/vocabulary'
import { cn } from '@/lib/utils'

interface Props {
  store: { id: string; slug: string; name: string; address: string | null }
  schedule: unknown
  config: ReservationConfig
  load: SlotLoad[]
  policy: string
  /** Fixed at render so the server HTML and the first client render agree. */
  nowIso: string
  /** The signed-in customer; null asks the visitor to sign in to book. */
  userId: string | null
  defaults: { name: string; phone: string }
  initial: { date: string | null; time: string | null; party: number | null }
}

type Period = 'Almuerzo' | 'Tarde' | 'Noche' | 'Madrugada'

function periodOf(slot: Slot): Period {
  if (slot.afterMidnight) return 'Madrugada'
  const hour = Number(slot.time.slice(0, 2))
  if (hour < 15) return 'Almuerzo'
  if (hour < 18) return 'Tarde'
  return 'Noche'
}

/** Arrow keys move between the radios of a group, as in a native radio set. */
function onRadioKeys(event: KeyboardEvent<HTMLDivElement>) {
  const keys = ['ArrowRight', 'ArrowDown', 'ArrowLeft', 'ArrowUp']
  if (!keys.includes(event.key)) return
  const radios = [
    ...event.currentTarget.querySelectorAll<HTMLButtonElement>(
      '[role="radio"]:not([disabled])',
    ),
  ]
  const index = radios.indexOf(document.activeElement as HTMLButtonElement)
  if (index < 0) return
  event.preventDefault()
  const step = event.key === 'ArrowRight' || event.key === 'ArrowDown' ? 1 : -1
  const next = radios[(index + step + radios.length) % radios.length]
  next.focus()
  next.click()
}

export function ReservationFlow({
  store,
  schedule,
  config,
  load,
  policy,
  nowIso,
  userId,
  defaults,
  initial,
}: Props) {
  const now = useMemo(() => new Date(nowIso), [nowIso])
  const dates = useMemo(
    () => bookableDates(schedule, config, now),
    [schedule, config, now],
  )
  const firstOpen = dates.find((d) => d.open)?.date ?? dates[0]?.date ?? ''
  const initialParty = Math.min(
    Math.max(initial.party ?? 2, 1),
    config.maxPartySize,
  )
  const initialDate =
    initial.date && dates.some((d) => d.date === initial.date)
      ? initial.date
      : firstOpen
  const [party, setParty] = useState(initialParty)
  const [date, setDate] = useState(initialDate)
  // The time chosen before signing in comes back once, here; changing the
  // day afterwards never re-selects it.
  const [startsAt, setStartsAt] = useState<string | null>(() => {
    if (!initial.time) return null
    const match = slotsFor({
      date: initialDate,
      schedule,
      config,
      load,
      partySize: initialParty,
      now,
    }).find((slot) => slot.time === initial.time && slot.available)
    return match?.startsAt ?? null
  })
  const [name, setName] = useState(defaults.name)
  const [phone, setPhone] = useState(defaults.phone)
  const [occasion, setOccasion] = useState<ReservationOccasion | ''>('')
  const [notes, setNotes] = useState('')
  const [errors, setErrors] = useState<Record<string, string>>({})
  const [pending, startTransition] = useTransition()
  // What was booked travels with the result: a live refresh recomputes the
  // slots underneath, and the card must not depend on them.
  const [done, setDone] = useState<{
    id: string
    code: string
    startsAt: string
    party: number
  } | null>(null)
  const doneHeading = useRef<HTMLHeadingElement>(null)
  const timeHeading = useRef<HTMLHeadingElement>(null)
  const signedIn = userId !== null

  const slots = useMemo(
    () => slotsFor({ date, schedule, config, load, partySize: party, now }),
    [date, schedule, config, load, party, now],
  )
  const selected = slots.find((slot) => slot.startsAt === startsAt) ?? null
  const grouped = useMemo(() => {
    const groups = new Map<Period, Slot[]>()
    for (const slot of slots) {
      const list = groups.get(periodOf(slot)) ?? []
      list.push(slot)
      groups.set(periodOf(slot), list)
    }
    return [...groups.entries()]
  }, [slots])
  const suggestions =
    slots.some((slot) => slot.available) || !date
      ? []
      : nextAvailableDates(
          { schedule, config, load, partySize: party, now, from: date },
          3,
        )

  const loginHref = `/login?next=${encodeURIComponent(
    `/t/${store.slug}/reservar?fecha=${date}${selected ? `&hora=${selected.time}` : ''}&personas=${party}`,
  )}`

  const submit = () => {
    if (!selected) return
    setErrors({})
    startTransition(async () => {
      const result = await createReservation({
        storeId: store.id,
        serviceDate: date,
        startsAt: selected.startsAt,
        partySize: party,
        contactName: name,
        contactPhone: phone,
        occasion,
        notes,
      })
      if (!result.ok) {
        if (result.field) setErrors({ [result.field]: result.error })
        if (result.reason === 'full') setStartsAt(null)
        toast.error(result.error)
        return
      }
      setDone({
        id: result.reservationId,
        code: result.code,
        startsAt: selected.startsAt,
        party,
      })
      requestAnimationFrame(() => doneHeading.current?.focus())
    })
  }

  if (done && userId) {
    return (
      <RequestStatusCard
        reservation={{ id: done.id, code: done.code }}
        userId={userId}
        store={{ name: store.name, address: store.address }}
        party={done.party}
        startsAt={done.startsAt}
        durationMinutes={config.durationMinutes}
        headingRef={doneHeading}
        onRebook={() => {
          setDone(null)
          setStartsAt(null)
          requestAnimationFrame(() => timeHeading.current?.focus())
        }}
      />
    )
  }

  return (
    <div className="space-y-6 pb-48 md:pb-28">
      <section aria-labelledby="personas" className="space-y-3">
        <h2 id="personas" className="font-display text-lg font-semibold">
          ¿Cuántas personas?
        </h2>
        <div className="flex items-center gap-4">
          <Button
            type="button"
            variant="outline"
            size="icon"
            className="size-12 rounded-full"
            aria-label="Una persona menos"
            disabled={party <= 1}
            onClick={() => setParty((p) => Math.max(1, p - 1))}
          >
            <MinusIcon aria-hidden="true" />
          </Button>
          <output
            aria-live="polite"
            className="font-display min-w-24 text-center text-2xl font-semibold tabular-nums"
          >
            {partyLabel(party)}
          </output>
          <Button
            type="button"
            variant="outline"
            size="icon"
            className="size-12 rounded-full"
            aria-label="Una persona más"
            disabled={party >= config.maxPartySize}
            onClick={() =>
              setParty((p) => Math.min(config.maxPartySize, p + 1))
            }
          >
            <PlusIcon aria-hidden="true" />
          </Button>
        </div>
        {party >= config.maxPartySize ? (
          <p className="text-muted-foreground text-sm">
            ¿Son más de {config.maxPartySize}? Escríbele directamente al
            restaurante.
          </p>
        ) : null}
      </section>

      <section aria-labelledby="dia" className="space-y-3">
        <h2 id="dia" className="font-display text-lg font-semibold">
          ¿Qué día?
        </h2>
        <div
          role="radiogroup"
          aria-labelledby="dia"
          onKeyDown={onRadioKeys}
          className="rail -mx-4 flex gap-2 overflow-x-auto px-4 pb-1"
        >
          {dates.map((option) => {
            const checked = option.date === date
            return (
              <button
                key={option.date}
                type="button"
                role="radio"
                aria-checked={checked}
                tabIndex={checked ? 0 : -1}
                disabled={!option.open}
                onClick={() => {
                  setDate(option.date)
                  setStartsAt(null)
                }}
                className={cn(
                  'rounded-control flex h-16 min-w-20 shrink-0 flex-col items-center justify-center border px-3 text-sm transition-colors',
                  checked
                    ? 'border-primary bg-primary text-primary-foreground shadow-1'
                    : 'border-border bg-card hover:bg-muted',
                  !option.open && 'cursor-not-allowed opacity-40',
                )}
              >
                <span className="font-semibold">
                  {formatReservationDay(option.date, now)}
                </span>
                {!option.open ? (
                  <span className="text-[11px]">Cerrado</span>
                ) : null}
              </button>
            )
          })}
        </div>
      </section>

      <section aria-labelledby="hora" className="space-y-3">
        <h2
          id="hora"
          ref={timeHeading}
          tabIndex={-1}
          className="font-display text-lg font-semibold outline-none"
        >
          ¿A qué hora?
        </h2>
        {grouped.length === 0 ? (
          <p className="text-muted-foreground text-sm">
            No hay horas disponibles ese día.
          </p>
        ) : (
          grouped.map(([period, list]) => (
            <div key={period} className="space-y-2">
              <h3 className="text-muted-foreground text-xs font-semibold tracking-wide uppercase">
                {period}
              </h3>
              <div
                role="radiogroup"
                aria-label={period}
                onKeyDown={onRadioKeys}
                className="grid grid-cols-3 gap-2 sm:grid-cols-5"
              >
                {list.map((slot) => {
                  const checked = slot.startsAt === startsAt
                  return (
                    <button
                      key={slot.startsAt}
                      type="button"
                      role="radio"
                      aria-checked={checked}
                      disabled={!slot.available}
                      onClick={() => setStartsAt(slot.startsAt)}
                      className={cn(
                        'rounded-control flex h-12 flex-col items-center justify-center border text-sm font-medium tabular-nums transition-colors',
                        checked
                          ? 'border-primary bg-primary text-primary-foreground'
                          : 'border-border bg-card hover:bg-muted',
                        !slot.available && 'cursor-not-allowed opacity-50',
                      )}
                    >
                      {slot.time}
                      {!slot.available ? (
                        <span className="text-[10px] font-normal">Lleno</span>
                      ) : null}
                    </button>
                  )
                })}
              </div>
            </div>
          ))
        )}
        {suggestions.length > 0 ? (
          <div className="flex flex-wrap items-center gap-2 text-sm">
            <span className="text-muted-foreground">Prueba otro día:</span>
            {suggestions.map((option) => (
              <button
                key={option}
                type="button"
                onClick={() => {
                  setDate(option)
                  setStartsAt(null)
                }}
                className="rounded-pill border-border hover:bg-muted h-9 border px-3"
              >
                {formatReservationDay(option, now)}
              </button>
            ))}
          </div>
        ) : null}
      </section>

      {signedIn ? (
        <section aria-labelledby="contacto" className="space-y-4">
          <h2 id="contacto" className="font-display text-lg font-semibold">
            Tus datos
          </h2>
          <div className="grid gap-4 sm:grid-cols-2">
            <div className="space-y-1.5">
              <Label htmlFor="resv-name">Nombre</Label>
              <Input
                id="resv-name"
                autoComplete="name"
                value={name}
                onChange={(event) => setName(event.target.value)}
                aria-invalid={Boolean(errors.contactName)}
                aria-describedby="resv-name-error"
                className="rounded-control h-11"
              />
              <FieldError id="resv-name-error" message={errors.contactName} />
            </div>
            <div className="space-y-1.5">
              <Label htmlFor="resv-phone">Celular</Label>
              <Input
                id="resv-phone"
                type="tel"
                inputMode="tel"
                autoComplete="tel"
                value={phone}
                onChange={(event) => setPhone(event.target.value)}
                aria-invalid={Boolean(errors.contactPhone)}
                aria-describedby="resv-phone-error"
                className="rounded-control h-11"
              />
              <FieldError id="resv-phone-error" message={errors.contactPhone} />
            </div>
          </div>
          <fieldset className="space-y-2">
            <legend className="text-sm font-medium">
              ¿Es una ocasión especial?{' '}
              <span className="text-muted-foreground font-normal">
                (opcional)
              </span>
            </legend>
            <div className="flex flex-wrap gap-2">
              {RESERVATION_OCCASIONS.map((option) => (
                <button
                  key={option}
                  type="button"
                  aria-pressed={occasion === option}
                  onClick={() => setOccasion(occasion === option ? '' : option)}
                  className={cn(
                    'rounded-pill h-10 border px-4 text-sm',
                    occasion === option
                      ? 'border-primary bg-primary/10 text-primary-on-tint'
                      : 'border-border hover:bg-muted',
                  )}
                >
                  {OCCASION_LABELS[option]}
                </button>
              ))}
            </div>
          </fieldset>
          <div className="space-y-1.5">
            <Label htmlFor="resv-notes">
              Algo que el restaurante deba saber{' '}
              <span className="text-muted-foreground font-normal">
                (opcional)
              </span>
            </Label>
            <Textarea
              id="resv-notes"
              value={notes}
              maxLength={300}
              placeholder="Silla de bebé, alergias, mesa en terraza…"
              onChange={(event) => setNotes(event.target.value)}
            />
          </div>
        </section>
      ) : null}

      {policy ? (
        <p className="text-muted-foreground border-border border-l-2 pl-3 text-sm">
          {policy}
        </p>
      ) : null}

      <div className="border-border bg-background/95 fixed inset-x-0 bottom-[calc(env(safe-area-inset-bottom)+4rem)] z-40 border-t p-4 backdrop-blur md:bottom-0 md:pb-[calc(env(safe-area-inset-bottom)+1rem)]">
        <div className="mx-auto flex max-w-2xl items-center justify-between gap-3">
          <p className="text-sm" aria-live="polite">
            {selected ? (
              <>
                <span className="font-semibold">{partyLabel(party)}</span> ·{' '}
                {formatReservationWhen(selected.startsAt)}
              </>
            ) : (
              <span className="text-muted-foreground">Elige día y hora</span>
            )}
          </p>
          {signedIn ? (
            <Button
              onClick={submit}
              disabled={!selected || pending}
              className="rounded-pill h-12 px-6"
            >
              {pending ? (
                <LoaderCircleIcon aria-hidden="true" className="animate-spin" />
              ) : null}
              Reservar
            </Button>
          ) : (
            <Button asChild className="rounded-pill h-12 px-6">
              <Link href={loginHref}>Inicia sesión para reservar</Link>
            </Button>
          )}
        </div>
      </div>
    </div>
  )
}
