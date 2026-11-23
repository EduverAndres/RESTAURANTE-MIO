// Which reservation times a store offers on a date, and how full they are.
// Pure: no React, no Supabase, and no local clock (see lib/store/hours.ts):
// it runs in the browser to draw the grid and on the server to validate the
// request, so the two can never disagree.
//
// Capacity is a pace: a slot accepts up to `coversPerSlot` guests whose
// reservation STARTS inside [slot, slot + slotMinutes). Pending, confirmed
// and seated reservations hold covers. Counting by range rather than by exact
// time keeps the rule right when the store changes its slot length.
//
// MIRRORED IN SQL: the capacity check in `public.create_reservation`
// (supabase/migrations/20261124000400_reservations.sql). If the two ever
// disagreed, the worst case is "that time just filled up", never an
// overbooking: the database has the last word.
import {
  addDays,
  bogotaClock,
  bogotaInstant,
  openingWindowOn,
} from '@/lib/store/hours'

const MS_PER_MIN = 60_000
const MINUTES_IN_DAY = 1440

export interface ReservationConfig {
  slotMinutes: number
  coversPerSlot: number
  maxPartySize: number
  minLeadMinutes: number
  maxDaysAhead: number
  durationMinutes: number
  blockedDates: readonly string[]
}

/** Covers already booked at one start time. */
export interface SlotLoad {
  /** Epoch milliseconds. */
  startsAt: number
  covers: number
}

export interface Slot {
  /** ISO instant. */
  startsAt: string
  /** "19:30", Bogotá wall clock. */
  time: string
  /** After midnight, still the service of `date` (e.g. Friday 01:00). */
  afterMidnight: boolean
  remaining: number
  available: boolean
  reason?: 'full' | 'party'
}

export interface BookableDate {
  date: string
  open: boolean
}

/** Rows from `reservations` (holding statuses) into loads. */
export function loadFromRows(
  rows: readonly { starts_at: string; party_size: number }[],
): SlotLoad[] {
  return rows.map((row) => ({
    startsAt: Date.parse(row.starts_at),
    covers: row.party_size,
  }))
}

/** Today (Bogotá) through today + maxDaysAhead, open or not. */
export function bookableDates(
  schedule: unknown,
  config: Pick<ReservationConfig, 'maxDaysAhead' | 'blockedDates'>,
  now: Date,
): BookableDate[] {
  const today = bogotaClock(now).date
  const dates: BookableDate[] = []
  for (let offset = 0; offset <= config.maxDaysAhead; offset += 1) {
    const date = addDays(today, offset)
    dates.push({
      date,
      open:
        !config.blockedDates.includes(date) &&
        openingWindowOn(schedule, date) !== null,
    })
  }
  return dates
}

function clock(minutes: number): string {
  const inDay = ((minutes % MINUTES_IN_DAY) + MINUTES_IN_DAY) % MINUTES_IN_DAY
  const h = Math.floor(inDay / 60)
  const m = inDay % 60
  return `${String(h).padStart(2, '0')}:${String(m).padStart(2, '0')}`
}

export interface SlotsInput {
  date: string
  schedule: unknown
  config: ReservationConfig
  load: readonly SlotLoad[]
  partySize: number
  now: Date
}

/**
 * The start times offered on `date`: every `slotMinutes` from opening, the
 * last one leaving `durationMinutes` before closing, none sooner than
 * `minLeadMinutes` from now and none past the horizon. Full slots are kept
 * (and marked) so the grid can say "Lleno" instead of silently skipping.
 */
export function slotsFor({
  date,
  schedule,
  config,
  load,
  partySize,
  now,
}: SlotsInput): Slot[] {
  if (config.blockedDates.includes(date)) return []
  const today = bogotaClock(now).date
  if (date < today || date > addDays(today, config.maxDaysAhead)) return []
  const window = openingWindowOn(schedule, date)
  if (!window) return []

  const step = config.slotMinutes
  const first = Math.ceil(window.start / step) * step
  const last = window.end - config.durationMinutes
  const earliest = now.getTime() + config.minLeadMinutes * MS_PER_MIN
  const slots: Slot[] = []

  for (let minutes = first; minutes <= last; minutes += step) {
    const instant = bogotaInstant(date, minutes)
    if (instant.getTime() < earliest) continue
    const from = instant.getTime()
    const to = from + step * MS_PER_MIN
    const booked = load
      .filter((entry) => entry.startsAt >= from && entry.startsAt < to)
      .reduce((sum, entry) => sum + entry.covers, 0)
    const remaining = Math.max(0, config.coversPerSlot - booked)
    const tooLarge = partySize > config.maxPartySize
    const full = remaining < partySize
    slots.push({
      startsAt: instant.toISOString(),
      time: clock(minutes),
      afterMidnight: minutes >= MINUTES_IN_DAY,
      remaining,
      available: !tooLarge && !full,
      ...(tooLarge
        ? { reason: 'party' as const }
        : full
          ? { reason: 'full' as const }
          : {}),
    })
  }
  return slots
}

/** The next dates (after `from`) with at least one available slot. */
export function nextAvailableDates(
  input: Omit<SlotsInput, 'date'> & { from: string },
  count = 3,
): string[] {
  const found: string[] = []
  const today = bogotaClock(input.now).date
  const horizon = addDays(today, input.config.maxDaysAhead)
  for (
    let date = addDays(input.from, 1);
    date <= horizon && found.length < count;
    date = addDays(date, 1)
  ) {
    if (slotsFor({ ...input, date }).some((slot) => slot.available))
      found.push(date)
  }
  return found
}

/**
 * Server-side validation of a requested start: it must be one of the slots
 * offered for `serviceDate` and still available for that party. Capacity is
 * checked again, atomically, by the database.
 */
export function checkStart(
  input: Omit<SlotsInput, 'date'> & { serviceDate: string; startsAt: Date },
): { ok: true } | { ok: false; error: string } {
  if (input.partySize > input.config.maxPartySize) {
    return {
      ok: false,
      error: `Para grupos de más de ${input.config.maxPartySize} personas, escríbele al restaurante.`,
    }
  }
  const slot = slotsFor({ ...input, date: input.serviceDate }).find(
    (candidate) => Date.parse(candidate.startsAt) === input.startsAt.getTime(),
  )
  if (!slot) return { ok: false, error: 'Esa hora ya no está disponible.' }
  if (!slot.available)
    return { ok: false, error: 'Esa hora se acaba de llenar. Elige otra.' }
  return { ok: true }
}
