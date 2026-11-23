// How reservation dates and times read in Spanish. Pure. Every formatter pins
// the Bogotá time zone and normalises ICU's no-break spaces, so the server
// HTML and the browser render the same text (see lib/format-date.ts).
import { normalizeIcuSpaces } from '@/lib/format-date'
import { addDays, bogotaClock } from '@/lib/store/hours'

const TZ = 'America/Bogota'

const whenFormatter = new Intl.DateTimeFormat('es-CO', {
  weekday: 'short',
  day: 'numeric',
  month: 'short',
  hour: 'numeric',
  minute: '2-digit',
  timeZone: TZ,
})

const timeFormatter = new Intl.DateTimeFormat('es-CO', {
  hour: 'numeric',
  minute: '2-digit',
  timeZone: TZ,
})

// A calendar date is formatted at UTC midnight in UTC, so no zone can move
// it to the day before.
const dayFormatter = new Intl.DateTimeFormat('es-CO', {
  weekday: 'short',
  day: 'numeric',
  month: 'short',
  timeZone: 'UTC',
})

const longDayFormatter = new Intl.DateTimeFormat('es-CO', {
  weekday: 'long',
  day: 'numeric',
  month: 'long',
  timeZone: 'UTC',
})

/** "vie, 27 nov, 7:30 p. m." */
export function formatReservationWhen(startsAt: Date | string): string {
  return normalizeIcuSpaces(
    whenFormatter.format(
      typeof startsAt === 'string' ? new Date(startsAt) : startsAt,
    ),
  )
}

/** "7:30 p. m." */
export function formatReservationTime(startsAt: Date | string): string {
  return normalizeIcuSpaces(
    timeFormatter.format(
      typeof startsAt === 'string' ? new Date(startsAt) : startsAt,
    ),
  )
}

/** "Hoy", "Mañana" or "vie, 28 nov" for a `YYYY-MM-DD` date. */
export function formatReservationDay(date: string, now: Date): string {
  const today = bogotaClock(now).date
  if (date === today) return 'Hoy'
  if (date === addDays(today, 1)) return 'Mañana'
  return normalizeIcuSpaces(
    dayFormatter.format(new Date(`${date}T00:00:00.000Z`)),
  )
}

/** "viernes, 27 de noviembre", for headings. */
export function formatReservationLongDay(date: string): string {
  return normalizeIcuSpaces(
    longDayFormatter.format(new Date(`${date}T00:00:00.000Z`)),
  )
}

/** "1 persona" / "4 personas". */
export function partyLabel(size: number): string {
  return `${size} ${size === 1 ? 'persona' : 'personas'}`
}
