// Who may move a reservation from one status to another, and when.
// Pure: no React, no Supabase.
//
// MIRRORED IN SQL: the set of allowed (from, to) pairs is enforced by the
// `guard_reservation_update` trigger
// (supabase/migrations/20261124000400_reservations.sql). The time and actor
// rules live here, in the server actions that perform each move.
import type { ReservationStatus } from '@/lib/reservations/vocabulary'

export type ReservationActor = 'customer' | 'store'

const MIN = 60_000

/** Every transition the database accepts. MIRRORED IN SQL. */
export const RESERVATION_TRANSITION_PAIRS: readonly (readonly [
  ReservationStatus,
  ReservationStatus,
])[] = [
  ['pending', 'confirmed'],
  ['pending', 'declined'],
  ['pending', 'cancelled'],
  ['confirmed', 'cancelled'],
  ['pending', 'seated'],
  ['confirmed', 'seated'],
  ['confirmed', 'no_show'],
  ['no_show', 'seated'],
  ['seated', 'confirmed'],
]

export interface TransitionInput {
  from: ReservationStatus
  to: ReservationStatus
  actor: ReservationActor
  startsAt: Date
  /** When the reservation entered `from` (seated_at, no_show_at…). */
  statusChangedAt: Date | null
  now: Date
}

const ERRORS = {
  forbidden: 'Ese cambio no es posible para esta reserva.',
  past: 'La hora de la reserva ya pasó.',
  early: 'Todavía es muy pronto para marcar a esta reserva.',
  undo: 'Ya no se puede deshacer.',
} as const

/** Whether `actor` may move the reservation `from` → `to` at `now`. */
export function checkTransition({
  from,
  to,
  actor,
  startsAt,
  statusChangedAt,
  now,
}: TransitionInput): { ok: true } | { ok: false; error: string } {
  const allowed = RESERVATION_TRANSITION_PAIRS.some(
    ([a, b]) => a === from && b === to,
  )
  if (!allowed) return { ok: false, error: ERRORS.forbidden }

  const t = now.getTime()
  const start = startsAt.getTime()

  if (actor === 'customer') {
    // A customer can only cancel, and only before the time.
    if (to !== 'cancelled') return { ok: false, error: ERRORS.forbidden }
    return t < start ? { ok: true } : { ok: false, error: ERRORS.past }
  }

  switch (to) {
    case 'confirmed':
      if (from === 'seated') {
        // Undo of "Llegó", for a mistaken tap.
        const since = statusChangedAt?.getTime() ?? 0
        return t - since <= 10 * MIN
          ? { ok: true }
          : { ok: false, error: ERRORS.undo }
      }
      return t < start ? { ok: true } : { ok: false, error: ERRORS.past }
    case 'declined':
      return t < start ? { ok: true } : { ok: false, error: ERRORS.past }
    case 'cancelled':
      // A store declines a request it never accepted; it cancels one it did.
      if (from !== 'confirmed') return { ok: false, error: ERRORS.forbidden }
      return t < start ? { ok: true } : { ok: false, error: ERRORS.past }
    case 'seated':
      if (from === 'no_show') {
        const since = statusChangedAt?.getTime() ?? 0
        return t - since <= 6 * 60 * MIN
          ? { ok: true }
          : { ok: false, error: ERRORS.undo }
      }
      return t >= start - 60 * MIN
        ? { ok: true }
        : { ok: false, error: ERRORS.early }
    case 'no_show':
      return t >= start + 15 * MIN
        ? { ok: true }
        : { ok: false, error: ERRORS.early }
    default:
      return { ok: false, error: ERRORS.forbidden }
  }
}

export type StoreAction =
  'confirm' | 'decline' | 'seat' | 'no_show' | 'cancel' | 'undo'

const ACTION_TARGET: Record<StoreAction, ReservationStatus> = {
  confirm: 'confirmed',
  decline: 'declined',
  seat: 'seated',
  no_show: 'no_show',
  cancel: 'cancelled',
  undo: 'confirmed',
}

export function actionTarget(action: StoreAction): ReservationStatus {
  return ACTION_TARGET[action]
}

/** The buttons the store sees on one reservation right now. */
export function storeActionsFor(
  reservation: {
    status: ReservationStatus
    startsAt: Date
    statusChangedAt: Date | null
  },
  now: Date,
): StoreAction[] {
  const actions: StoreAction[] = [
    'confirm',
    'decline',
    'seat',
    'no_show',
    'cancel',
  ]
  const offered = actions.filter(
    (action) =>
      // Back from "seated" is labelled as an undo, below, not a confirm.
      !(action === 'confirm' && reservation.status === 'seated') &&
      checkTransition({
        from: reservation.status,
        to: ACTION_TARGET[action],
        actor: 'store',
        startsAt: reservation.startsAt,
        statusChangedAt: reservation.statusChangedAt,
        now,
      }).ok,
  )
  if (
    reservation.status === 'seated' &&
    checkTransition({
      from: 'seated',
      to: 'confirmed',
      actor: 'store',
      startsAt: reservation.startsAt,
      statusChangedAt: reservation.statusChangedAt,
      now,
    }).ok
  )
    offered.push('undo')
  return offered
}

export function customerCanCancel(
  reservation: { status: ReservationStatus; startsAt: Date },
  now: Date,
): boolean {
  return checkTransition({
    from: reservation.status,
    to: 'cancelled',
    actor: 'customer',
    startsAt: reservation.startsAt,
    statusChangedAt: null,
    now,
  }).ok
}

/** A pending request whose time passed without an answer reads as expired. */
export function displayStatus(
  reservation: { status: ReservationStatus; startsAt: Date },
  now: Date,
): ReservationStatus | 'expired' {
  if (
    reservation.status === 'pending' &&
    reservation.startsAt.getTime() <= now.getTime()
  )
    return 'expired'
  return reservation.status
}
