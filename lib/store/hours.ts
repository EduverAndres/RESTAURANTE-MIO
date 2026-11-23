// Opening hours: reads the untrusted `stores.schedule` jsonb column and turns
// it into something a chip and a table can render. Pure and total — every
// helper takes `now` so it can be tested without freezing the clock.

import type { ScheduleDay, StoreSchedule, WeekDay } from '@/types/app'

/** Monday-first, the way a Colombian opening-hours table is read. */
export const WEEK_DAY_ORDER: readonly WeekDay[] = [
  'mon',
  'tue',
  'wed',
  'thu',
  'fri',
  'sat',
  'sun',
]

export const WEEK_DAY_LABELS: Record<WeekDay, string> = {
  mon: 'Lunes',
  tue: 'Martes',
  wed: 'Miércoles',
  thu: 'Jueves',
  fri: 'Viernes',
  sat: 'Sábado',
  sun: 'Domingo',
}

/** Lower-case, for "Abre el viernes a las 18:00". */
const WEEK_DAY_NAMES: Record<WeekDay, string> = {
  mon: 'lunes',
  tue: 'martes',
  wed: 'miércoles',
  thu: 'jueves',
  fri: 'viernes',
  sat: 'sábado',
  sun: 'domingo',
}

const MINUTES_IN_DAY = 24 * 60

/** Minutes since midnight for "HH:MM", or null when it is not a clock time. */
export function timeToMinutes(value: string): number | null {
  const match = /^([01]\d|2[0-3]):([0-5]\d)$/.exec(value.trim())
  if (!match) return null
  return Number(match[1]) * 60 + Number(match[2])
}

/** `Date.getDay()` is Sunday-first; the schedule column is Monday-first. */
export function weekDayOf(date: Date): WeekDay {
  return WEEK_DAY_ORDER[(date.getDay() + 6) % 7]
}

function isUsableDay(value: unknown): value is ScheduleDay {
  if (typeof value !== 'object' || value === null) return false
  const day = value as Partial<ScheduleDay>
  return (
    typeof day.open === 'string' &&
    typeof day.close === 'string' &&
    timeToMinutes(day.open) !== null &&
    timeToMinutes(day.close) !== null
  )
}

/** Keeps the seven known keys whose times parse; drops everything else. */
export function parseSchedule(raw: unknown): StoreSchedule {
  if (typeof raw !== 'object' || raw === null || Array.isArray(raw)) return {}
  const source = raw as Record<string, unknown>
  const schedule: StoreSchedule = {}
  for (const day of WEEK_DAY_ORDER) {
    const entry = source[day]
    if (isUsableDay(entry))
      schedule[day] = { open: entry.open, close: entry.close }
  }
  return schedule
}

export interface ScheduleRow {
  day: WeekDay
  label: string
  hours: ScheduleDay | null
  today: boolean
}

/** The seven rows of the info section, in reading order, today flagged. */
export function weeklySchedule(raw: unknown, now?: Date): ScheduleRow[] {
  const schedule = parseSchedule(raw)
  const today = now ? weekDayOf(now) : null
  return WEEK_DAY_ORDER.map((day) => ({
    day,
    label: WEEK_DAY_LABELS[day],
    hours: schedule[day] ?? null,
    today: day === today,
  }))
}

/** Minutes since Monday 00:00 of a day's opening and closing edges. */
function windowOf(day: WeekDay, hours: ScheduleDay) {
  const index = WEEK_DAY_ORDER.indexOf(day)
  const open = timeToMinutes(hours.open) ?? 0
  const close = timeToMinutes(hours.close) ?? 0
  const start = index * MINUTES_IN_DAY + open
  // A closing time at or before the opening time means the window runs past
  // midnight into the next day (18:00 → 02:00).
  const end =
    start + (close > open ? close - open : MINUTES_IN_DAY - open + close)
  return { start, end }
}

/** How soon the chip switches from "Abierto" to a countdown. */
const CLOSING_SOON_MIN = 60

export interface StoreHoursState {
  open: boolean
  /** Minutes left, only when it closes within the next hour. */
  closesInMin: number | null
  /** "HH:MM" of the next opening while closed. */
  opensAt: string | null
  /** Ready to render, Spanish, no further formatting needed. */
  label: string
  today: WeekDay
}

export interface StoreHoursInput {
  /** The raw `stores.schedule` column. */
  schedule: unknown
  /** The merchant's master switch (`stores.is_open`). */
  isOpen: boolean
  now: Date
}

/**
 * Resolves the open/closed state the storefront shows.
 *
 * `isOpen` is the merchant's master switch and always wins: a store that
 * turned itself off is closed even inside its published hours. A store with no
 * usable schedule falls back to that switch alone.
 */
export function storeHoursState(input: StoreHoursInput): StoreHoursState {
  const today = weekDayOf(input.now)
  const schedule = parseSchedule(input.schedule)
  const days = WEEK_DAY_ORDER.filter((day) => schedule[day])

  if (!input.isOpen) {
    return {
      open: false,
      closesInMin: null,
      opensAt: null,
      label: 'Cerrado ahora',
      today,
    }
  }

  if (days.length === 0) {
    return {
      open: true,
      closesInMin: null,
      opensAt: null,
      label: 'Abierto ahora',
      today,
    }
  }

  const nowMinutes =
    WEEK_DAY_ORDER.indexOf(today) * MINUTES_IN_DAY +
    input.now.getHours() * 60 +
    input.now.getMinutes()
  const week = 7 * MINUTES_IN_DAY

  // Windows are checked in this week and in the previous one, so a window
  // that started on Sunday evening still counts after midnight on Monday.
  for (const day of days) {
    const hours = schedule[day]
    if (!hours) continue
    const { start, end } = windowOf(day, hours)
    for (const offset of [0, -week]) {
      if (nowMinutes >= start + offset && nowMinutes < end + offset) {
        const left = end + offset - nowMinutes
        const closesInMin = left <= CLOSING_SOON_MIN ? left : null
        return {
          open: true,
          closesInMin,
          opensAt: null,
          label:
            closesInMin === null
              ? 'Abierto ahora'
              : `Cierra en ${closesInMin} min`,
          today,
        }
      }
    }
  }

  // Closed: find the next opening within the coming week.
  let best: { at: number; day: WeekDay; time: string } | null = null
  for (const day of days) {
    const hours = schedule[day]
    if (!hours) continue
    const { start } = windowOf(day, hours)
    for (const offset of [0, week]) {
      const at = start + offset
      if (at <= nowMinutes) continue
      if (!best || at < best.at) best = { at, day, time: hours.open }
    }
  }

  if (!best) {
    return {
      open: false,
      closesInMin: null,
      opensAt: null,
      label: 'Cerrado ahora',
      today,
    }
  }

  const daysAway =
    Math.floor(best.at / MINUTES_IN_DAY) -
    Math.floor(nowMinutes / MINUTES_IN_DAY)
  const when =
    daysAway === 0
      ? 'hoy'
      : daysAway === 1
        ? 'mañana'
        : `el ${WEEK_DAY_NAMES[best.day]}`

  return {
    open: false,
    closesInMin: null,
    opensAt: best.time,
    label: `Abre ${when} a las ${best.time}`,
    today,
  }
}

// ---------------------------------------------------------------------------
// Bogotá-explicit helpers, for dates in the future (reservations).
//
// `storeHoursState` reads the runtime's local clock, which the server pins to
// Bogotá (instrumentation.ts). Reservation slots are computed in the browser
// too, where the clock may be anywhere, so these never call getHours() or
// getDay(): Colombia is UTC-5 all year, and the offset is applied by hand.
// ---------------------------------------------------------------------------

/** Colombia has no daylight saving time. */
export const BOGOTA_OFFSET_MIN = -300

const MS_PER_MIN = 60_000

/** The Bogotá calendar date, minute of day and weekday of an instant. */
export function bogotaClock(at: Date): {
  date: string
  minutes: number
  day: WeekDay
} {
  const shifted = new Date(at.getTime() + BOGOTA_OFFSET_MIN * MS_PER_MIN)
  const date = shifted.toISOString().slice(0, 10)
  return {
    date,
    minutes: shifted.getUTCHours() * 60 + shifted.getUTCMinutes(),
    day: weekDayOfDate(date),
  }
}

/**
 * The instant at `minutes` past midnight (Bogotá) of `date`. Minutes of 1440
 * or more land on the following day, which is how a window past midnight
 * (18:00 → 02:00) is written.
 */
export function bogotaInstant(date: string, minutes: number): Date {
  const midnightUtc = Date.parse(`${date}T00:00:00.000Z`)
  return new Date(midnightUtc + (minutes - BOGOTA_OFFSET_MIN) * MS_PER_MIN)
}

/** `YYYY-MM-DD` plus `days` (negative goes back). */
export function addDays(date: string, days: number): string {
  const next = new Date(`${date}T00:00:00.000Z`)
  next.setUTCDate(next.getUTCDate() + days)
  return next.toISOString().slice(0, 10)
}

/** Weekday of a calendar date, independent of any time zone. */
export function weekDayOfDate(date: string): WeekDay {
  const day = new Date(`${date}T00:00:00.000Z`).getUTCDay()
  return WEEK_DAY_ORDER[(day + 6) % 7]
}

/** Minutes past that date's midnight; `end` exceeds 1440 past midnight. */
export interface OpeningWindow {
  start: number
  end: number
}

/** The opening window that starts on `date`, or null when closed that day. */
export function openingWindowOn(
  schedule: unknown,
  date: string,
): OpeningWindow | null {
  const hours = parseSchedule(schedule)[weekDayOfDate(date)]
  if (!hours) return null
  const open = timeToMinutes(hours.open) ?? 0
  const close = timeToMinutes(hours.close) ?? 0
  return {
    start: open,
    end: close > open ? close : MINUTES_IN_DAY + close,
  }
}

/**
 * Whether the store's schedule covers the instant `at`, including the tail
 * of the previous day's window past midnight. Ignores the master switch,
 * which only means something for "now".
 */
export function isWithinOpeningHours(schedule: unknown, at: Date): boolean {
  const { date, minutes } = bogotaClock(at)
  const today = openingWindowOn(schedule, date)
  if (today && minutes >= today.start && minutes < today.end) return true
  const yesterday = openingWindowOn(schedule, addDays(date, -1))
  return (
    yesterday !== null &&
    yesterday.end > MINUTES_IN_DAY &&
    minutes + MINUTES_IN_DAY < yesterday.end
  )
}
