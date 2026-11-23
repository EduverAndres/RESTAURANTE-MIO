// Reservation vocabulary. Pure, safe on client and server.
//
// MIRRORED IN SQL: the check constraints and the transition guard of
// `public.reservations` (supabase/migrations/20261124000400_reservations.sql)
// embed these lists between `codegen:` markers;
// tests/reservations-sql-drift.test.ts compares them.
import type { StatusTone } from '@/lib/orders/status'

export const RESERVATION_STATUSES = [
  'pending',
  'confirmed',
  'declined',
  'cancelled',
  'seated',
  'no_show',
] as const
export type ReservationStatus = (typeof RESERVATION_STATUSES)[number]

export const RESERVATION_STATUS_LABELS: Record<ReservationStatus, string> = {
  pending: 'Por confirmar',
  confirmed: 'Confirmada',
  declined: 'Rechazada',
  cancelled: 'Cancelada',
  seated: 'Llegó',
  no_show: 'No llegó',
}

export const RESERVATION_STATUS_TONES: Record<ReservationStatus, StatusTone> = {
  pending: 'warning',
  confirmed: 'success',
  declined: 'destructive',
  cancelled: 'neutral',
  seated: 'primary',
  no_show: 'destructive',
}

/** Reservations that hold covers in a slot (capacity counts them). */
export const HOLDING_STATUSES: readonly ReservationStatus[] = [
  'pending',
  'confirmed',
  'seated',
]

/** Reservations still waiting to happen (one per customer, store and day). */
export const ACTIVE_STATUSES: readonly ReservationStatus[] = [
  'pending',
  'confirmed',
]

export const RESERVATION_OCCASIONS = [
  'birthday',
  'anniversary',
  'date',
  'business',
  'celebration',
  'other',
] as const
export type ReservationOccasion = (typeof RESERVATION_OCCASIONS)[number]

export const OCCASION_LABELS: Record<ReservationOccasion, string> = {
  birthday: 'Cumpleaños',
  anniversary: 'Aniversario',
  date: 'Cita',
  business: 'Negocios',
  celebration: 'Celebración',
  other: 'Otra',
}

export const DECLINE_REASONS = [
  'Sin cupo a esa hora',
  'Cerrado ese día',
  'Evento privado',
] as const
