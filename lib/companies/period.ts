// Billing periods of corporate accounts: calendar months in Bogotá.
//
// A period is written as its first day, `YYYY-MM-01`, the same value the
// database stores in `orders.corporate_period` and `company_statements.period`.
// Colombia has had no daylight saving since 1993, so Bogotá is UTC−5 all year
// and the arithmetic below is plain UTC on shifted instants — no `Intl`, no
// dependence on the machine's time zone.
//
// MIRRORED IN SQL: `public.bogota_month_start()` in
// supabase/migrations/20261124000600_companies.sql.

const BOGOTA_OFFSET_MS = 5 * 60 * 60 * 1000

const MONTHS = [
  'enero',
  'febrero',
  'marzo',
  'abril',
  'mayo',
  'junio',
  'julio',
  'agosto',
  'septiembre',
  'octubre',
  'noviembre',
  'diciembre',
] as const

/** Today's date in Bogotá, `YYYY-MM-DD`. */
export function bogotaToday(now: Date = new Date()): string {
  return new Date(now.getTime() - BOGOTA_OFFSET_MS).toISOString().slice(0, 10)
}

/** The current period: the first day of this month in Bogotá. */
export function bogotaMonthStart(now: Date = new Date()): string {
  return `${bogotaToday(now).slice(0, 8)}01`
}

export function isPeriod(value: string): boolean {
  const match = /^(\d{4})-(\d{2})-01$/.exec(value)
  if (!match) return false
  const month = Number(match[2])
  return month >= 1 && month <= 12
}

function shiftMonths(period: string, months: number): string {
  const year = Number(period.slice(0, 4))
  const month = Number(period.slice(5, 7)) - 1 + months
  const date = new Date(Date.UTC(year, month, 1))
  return date.toISOString().slice(0, 10)
}

export function nextPeriod(period: string): string {
  return shiftMonths(period, 1)
}

export function previousPeriod(period: string): string {
  return shiftMonths(period, -1)
}

/** `[start, end)` of a period as instants: Bogotá midnight is 05:00 UTC. */
export function periodBounds(period: string): { start: Date; end: Date } {
  return {
    start: new Date(`${period}T05:00:00.000Z`),
    end: new Date(`${nextPeriod(period)}T05:00:00.000Z`),
  }
}

/** "noviembre de 2026". */
export function periodLabel(period: string): string {
  const month = MONTHS[Number(period.slice(5, 7)) - 1]
  return `${month} de ${period.slice(0, 4)}`
}

/** The `count` months before the current one, newest first. */
export function recentClosedPeriods(now: Date, count: number): string[] {
  const current = bogotaMonthStart(now)
  return Array.from({ length: count }, (_, index) =>
    shiftMonths(current, -(index + 1)),
  )
}

/** `YYYY-MM-DD` plus `days` calendar days. */
export function addDaysToDate(date: string, days: number): string {
  const at = new Date(`${date}T00:00:00.000Z`)
  at.setUTCDate(at.getUTCDate() + days)
  return at.toISOString().slice(0, 10)
}
