// Shapes reservations for the store's board. Pure.
import type { ReservationStatus } from '@/lib/reservations/vocabulary'

export interface BoardReservation {
  id: string
  status: ReservationStatus
  starts_at: string
  service_date: string
  party_size: number
  customer_id: string
}

export interface ReservationDay<T extends BoardReservation> {
  date: string
  reservations: T[]
}

/** By service date, then by time; days and rows ascending. */
export function groupByServiceDate<T extends BoardReservation>(
  rows: readonly T[],
): ReservationDay<T>[] {
  const days = new Map<string, T[]>()
  for (const row of [...rows].sort((a, b) =>
    a.starts_at.localeCompare(b.starts_at),
  )) {
    const list = days.get(row.service_date) ?? []
    list.push(row)
    days.set(row.service_date, list)
  }
  return [...days.entries()]
    .sort(([a], [b]) => a.localeCompare(b))
    .map(([date, reservations]) => ({ date, reservations }))
}

export interface DaySummary {
  /** Reservations expected (pending, confirmed or seated). */
  reservations: number
  covers: number
  pending: number
  seated: number
}

const EXPECTED: readonly ReservationStatus[] = [
  'pending',
  'confirmed',
  'seated',
]

export function daySummary(rows: readonly BoardReservation[]): DaySummary {
  const expected = rows.filter((row) => EXPECTED.includes(row.status))
  return {
    reservations: expected.length,
    covers: expected.reduce((sum, row) => sum + row.party_size, 0),
    pending: rows.filter((row) => row.status === 'pending').length,
    seated: rows.filter((row) => row.status === 'seated').length,
  }
}

export interface GuestHistory {
  visits: number
  noShows: number
}

/**
 * How a customer has behaved at THIS store: visits and no-shows. Kept to one
 * store on purpose (data minimisation, Ley 1581).
 */
export function guestHistory(
  rows: readonly Pick<BoardReservation, 'customer_id' | 'status'>[],
): Map<string, GuestHistory> {
  const history = new Map<string, GuestHistory>()
  for (const row of rows) {
    const entry = history.get(row.customer_id) ?? { visits: 0, noShows: 0 }
    if (row.status === 'seated') entry.visits += 1
    if (row.status === 'no_show') entry.noShows += 1
    history.set(row.customer_id, entry)
  }
  return history
}
