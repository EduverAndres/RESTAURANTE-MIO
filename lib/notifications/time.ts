// "hace 5 min" for the bell. Pure: written by hand instead of with
// Intl.RelativeTimeFormat so the server, Node and every browser print the same
// characters (ICU's spaces differ between them, see lib/format-date.ts).
import { formatDateCO } from '@/lib/format-date'

const MINUTE = 60_000
const HOUR = 60 * MINUTE
const DAY = 24 * HOUR

/** How long ago `iso` was, from `now` (epoch milliseconds). */
export function relativeTimeLabel(iso: string, now: number): string {
  const elapsed = Math.max(0, now - new Date(iso).getTime())
  if (elapsed < MINUTE) return 'ahora'
  if (elapsed < HOUR) return `hace ${Math.floor(elapsed / MINUTE)} min`
  if (elapsed < DAY) return `hace ${Math.floor(elapsed / HOUR)} h`
  if (elapsed < 2 * DAY) return 'ayer'
  if (elapsed < 7 * DAY) return `hace ${Math.floor(elapsed / DAY)} días`
  return formatDateCO(iso)
}

/** "/admin/publicidad" yes; "//host" or "https://…" no. */
export function isInAppPath(url: string): boolean {
  return url.startsWith('/') && !url.startsWith('//')
}

/** The badge on the bell: a count, capped so it stays one small circle. */
export function unreadBadge(count: number): string | null {
  if (count <= 0) return null
  return count > 9 ? '9+' : String(count)
}
