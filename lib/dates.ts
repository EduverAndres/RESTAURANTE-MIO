// Date helpers shared by the dashboard. No React, no Supabase.

/** Midnight of `date` in the runtime's local time zone. */
export function startOfLocalDay(date: Date): Date {
  const start = new Date(date)
  start.setHours(0, 0, 0, 0)
  return start
}

/**
 * Date-only string (`YYYY-MM-DD`) for `date` in the runtime's local time
 * zone. Used for payout periods, which are calendar days and therefore
 * timezone-agnostic once expressed this way.
 */
export function toDateOnly(date: Date): string {
  const year = date.getFullYear()
  const month = String(date.getMonth() + 1).padStart(2, '0')
  const day = String(date.getDate()).padStart(2, '0')
  return `${year}-${month}-${day}`
}

export interface DateOnlyRange {
  start: string
  end: string
}

/** Inclusive Monday-to-Sunday week containing `date`. */
export function weekBounds(date: Date): DateOnlyRange {
  const start = startOfLocalDay(date)
  const weekday = start.getDay() // 0 = Sunday, 1 = Monday, …
  const offsetToMonday = (weekday + 6) % 7
  start.setDate(start.getDate() - offsetToMonday)
  const end = new Date(start)
  end.setDate(end.getDate() + 6)
  return { start: toDateOnly(start), end: toDateOnly(end) }
}

/** Inclusive calendar month containing `date`. */
export function monthBounds(date: Date): DateOnlyRange {
  const start = new Date(date.getFullYear(), date.getMonth(), 1)
  const end = new Date(date.getFullYear(), date.getMonth() + 1, 0)
  return { start: toDateOnly(start), end: toDateOnly(end) }
}
