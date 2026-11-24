// What the card on the booking page says once the customer has asked for a
// table, for each status the restaurant can move it to. Pure, so the copy is
// tested on its own and the card only renders it.
import type { ReservationStatus } from '@/lib/reservations/vocabulary'

export type RequestTone = 'pending' | 'success' | 'danger'

export interface RequestStatusCopy {
  title: string
  body: string
  tone: RequestTone
  /** The booking still stands: offer to add it to the calendar. */
  showCalendar: boolean
  /** It no longer stands: offer to pick another time. */
  canRebook: boolean
}

export interface RequestStatusInput {
  storeName: string
  /** `formatReservationWhen`, e.g. "mié, 25 nov, 7:30 p. m." */
  when: string
  /** `partyLabel`, e.g. "2 personas". */
  party: string
  reason: string | null
  cancelledBy: string | null
}

/** Closes a sentence without doubling the period of "p. m.". */
function sentence(text: string): string {
  const trimmed = text.trim()
  return /[.!?…]$/.test(trimmed) ? trimmed : `${trimmed}.`
}

function withReason(text: string, reason: string | null): string {
  const why = reason?.trim()
  return why ? `${text} Motivo: ${sentence(why)}` : text
}

export function requestStatusCopy(
  status: ReservationStatus,
  input: RequestStatusInput,
): RequestStatusCopy {
  const { storeName, when, party, reason, cancelledBy } = input
  switch (status) {
    case 'pending':
      return {
        title: 'Solicitud enviada',
        body: `${storeName} confirmará tu mesa para ${party} el ${sentence(when)} Te avisamos apenas responda.`,
        tone: 'pending',
        showCalendar: true,
        canRebook: false,
      }
    case 'confirmed':
      return {
        title: '¡Mesa confirmada!',
        body: `${storeName} te espera el ${sentence(when)} Mesa para ${party}.`,
        tone: 'success',
        showCalendar: true,
        canRebook: false,
      }
    case 'declined':
      return {
        title: 'No pudieron confirmar tu mesa',
        body: withReason(
          `${storeName} no pudo confirmar tu mesa del ${sentence(when)}`,
          reason,
        ),
        tone: 'danger',
        showCalendar: false,
        canRebook: true,
      }
    case 'cancelled':
      return {
        title: 'Reserva cancelada',
        body:
          cancelledBy === 'customer'
            ? `Cancelaste tu mesa del ${sentence(when)}`
            : withReason(
                `${storeName} canceló tu mesa del ${sentence(when)}`,
                reason,
              ),
        tone: 'danger',
        showCalendar: false,
        canRebook: true,
      }
    case 'seated':
      return {
        title: '¡Gracias por venir!',
        body: `Tu visita a ${storeName} quedó registrada.`,
        tone: 'success',
        showCalendar: false,
        canRebook: true,
      }
    case 'no_show':
      return {
        title: 'Marcada como no llegaste',
        body: `${storeName} marcó que no llegaste a tu mesa del ${sentence(when)}`,
        tone: 'danger',
        showCalendar: false,
        canRebook: true,
      }
  }
}
