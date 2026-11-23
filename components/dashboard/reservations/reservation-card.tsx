'use client'

import {
  CakeIcon,
  LoaderCircleIcon,
  MessageCircleIcon,
  PhoneIcon,
  StickyNoteIcon,
  UsersIcon,
} from 'lucide-react'
import { useRouter } from 'next/navigation'
import { useState, useTransition } from 'react'
import { toast } from 'sonner'
import { actOnReservation } from '@/app/dashboard/reservas/actions'
import { StatusBadge } from '@/components/orders/order-status-badge'
import { Button } from '@/components/ui/button'
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog'
import { Textarea } from '@/components/ui/textarea'
import { buildWhatsAppUrl } from '@/lib/orders/whatsapp'
import { formatReservationTime, partyLabel } from '@/lib/reservations/format'
import {
  displayStatus,
  storeActionsFor,
  type StoreAction,
} from '@/lib/reservations/transitions'
import {
  DECLINE_REASONS,
  OCCASION_LABELS,
  RESERVATION_STATUS_LABELS,
  RESERVATION_STATUS_TONES,
  type ReservationOccasion,
  type ReservationStatus,
} from '@/lib/reservations/vocabulary'
import { cn } from '@/lib/utils'

export interface StoreReservation {
  id: string
  code: string
  status: ReservationStatus
  starts_at: string
  service_date: string
  party_size: number
  customer_id: string
  contact_name: string
  contact_phone: string
  occasion: string | null
  notes: string | null
  decline_reason: string | null
  cancel_reason: string | null
  seated_at: string | null
  no_show_at: string | null
}

const ACTION_LABELS: Record<StoreAction, string> = {
  confirm: 'Confirmar',
  decline: 'Rechazar',
  seat: 'Llegó',
  no_show: 'No llegó',
  cancel: 'Cancelar',
  undo: 'Deshacer',
}

const SUCCESS: Record<StoreAction, string> = {
  confirm: 'Reserva confirmada. Le avisamos al cliente.',
  decline: 'Reserva rechazada. Le avisamos al cliente.',
  seat: 'Marcada como llegó.',
  no_show: 'Marcada como no llegó.',
  cancel: 'Reserva cancelada. Le avisamos al cliente.',
  undo: 'Listo, volvió a confirmada.',
}

function changedAt(reservation: StoreReservation): Date | null {
  if (reservation.status === 'seated' && reservation.seated_at)
    return new Date(reservation.seated_at)
  if (reservation.status === 'no_show' && reservation.no_show_at)
    return new Date(reservation.no_show_at)
  return null
}

/** One reservation, with the actions that make sense right now. */
export function ReservationCard({
  reservation,
  history,
  nowIso,
}: {
  reservation: StoreReservation
  history: { visits: number; noShows: number } | undefined
  nowIso: string
}) {
  const router = useRouter()
  const [pending, startTransition] = useTransition()
  const [dialog, setDialog] = useState<'decline' | 'cancel' | null>(null)
  const [reason, setReason] = useState('')
  const now = new Date(nowIso)
  const startsAt = new Date(reservation.starts_at)
  const status = displayStatus({ status: reservation.status, startsAt }, now)
  const actions = storeActionsFor(
    {
      status: reservation.status,
      startsAt,
      statusChangedAt: changedAt(reservation),
    },
    now,
  )

  const run = (action: StoreAction, why = '') => {
    startTransition(async () => {
      const result = await actOnReservation({
        reservationId: reservation.id,
        action,
        reason: why,
      })
      if (!result.ok) {
        toast.error(result.error)
        router.refresh()
        return
      }
      toast.success(SUCCESS[action])
      setDialog(null)
      setReason('')
      router.refresh()
    })
  }

  const whatsapp = buildWhatsAppUrl(
    reservation.contact_phone,
    `Hola ${reservation.contact_name.split(' ')[0]}, te escribimos por tu reserva ${reservation.code}.`,
  )

  return (
    <article
      id={`reserva-${reservation.id}`}
      aria-label={`Reserva de ${reservation.contact_name}, ${formatReservationTime(startsAt)}`}
      className={cn(
        'rounded-card bg-card shadow-1 space-y-3 p-4',
        reservation.status === 'pending' && 'ring-accent/50 ring-2',
      )}
    >
      <header className="flex flex-wrap items-start justify-between gap-3">
        <div>
          <p className="font-display text-2xl font-semibold tabular-nums">
            {formatReservationTime(startsAt)}
          </p>
          <p className="text-muted-foreground font-mono text-xs">
            {reservation.code}
          </p>
        </div>
        <div className="flex flex-col items-end gap-1">
          <StatusBadge
            label={
              status === 'expired'
                ? 'Sin respuesta'
                : RESERVATION_STATUS_LABELS[status]
            }
            tone={
              status === 'expired'
                ? 'neutral'
                : RESERVATION_STATUS_TONES[status]
            }
          />
          <span className="flex items-center gap-1 text-lg font-semibold">
            <UsersIcon aria-hidden="true" className="size-4" />
            {partyLabel(reservation.party_size)}
          </span>
        </div>
      </header>

      <div className="space-y-1.5 text-sm">
        <p className="font-medium">{reservation.contact_name}</p>
        <div className="flex flex-wrap gap-x-4 gap-y-1">
          <a
            href={`tel:${reservation.contact_phone}`}
            className="text-primary-on-tint inline-flex items-center gap-1 underline-offset-2 hover:underline"
          >
            <PhoneIcon aria-hidden="true" className="size-3.5" />
            {reservation.contact_phone}
          </a>
          {whatsapp ? (
            <a
              href={whatsapp}
              target="_blank"
              rel="noopener noreferrer"
              className="text-primary-on-tint inline-flex items-center gap-1 underline-offset-2 hover:underline"
            >
              <MessageCircleIcon aria-hidden="true" className="size-3.5" />
              WhatsApp
            </a>
          ) : null}
        </div>
        {reservation.occasion ? (
          <p className="inline-flex items-center gap-1">
            <CakeIcon aria-hidden="true" className="size-3.5" />
            {OCCASION_LABELS[reservation.occasion as ReservationOccasion] ??
              reservation.occasion}
          </p>
        ) : null}
        {reservation.notes ? (
          <p className="text-muted-foreground flex gap-1">
            <StickyNoteIcon
              aria-hidden="true"
              className="mt-0.5 size-3.5 shrink-0"
            />
            {reservation.notes}
          </p>
        ) : null}
        {history && (history.visits > 0 || history.noShows > 0) ? (
          <p className="text-muted-foreground text-xs">
            En tu restaurante: {history.visits} visita
            {history.visits === 1 ? '' : 's'}
            {history.noShows > 0 ? (
              <span className="text-destructive">
                {' '}
                · {history.noShows} vez{history.noShows === 1 ? '' : 'es'} no
                llegó
              </span>
            ) : null}
          </p>
        ) : null}
        {reservation.decline_reason || reservation.cancel_reason ? (
          <p className="text-muted-foreground text-xs">
            Motivo: {reservation.decline_reason ?? reservation.cancel_reason}
          </p>
        ) : null}
      </div>

      {actions.length > 0 ? (
        <div className="flex flex-wrap gap-2">
          {actions.map((action) => (
            <Button
              key={action}
              size="sm"
              disabled={pending}
              variant={
                action === 'confirm' || action === 'seat'
                  ? 'default'
                  : action === 'decline' || action === 'cancel'
                    ? 'outline'
                    : 'ghost'
              }
              className="rounded-pill h-10 px-4"
              onClick={() =>
                action === 'decline' || action === 'cancel'
                  ? setDialog(action)
                  : run(action)
              }
            >
              {pending ? (
                <LoaderCircleIcon aria-hidden="true" className="animate-spin" />
              ) : null}
              {ACTION_LABELS[action]}
            </Button>
          ))}
        </div>
      ) : null}

      <Dialog
        open={dialog !== null}
        onOpenChange={(open) => {
          if (!open) setDialog(null)
        }}
      >
        {dialog ? (
          <DialogContent>
            <DialogHeader>
              <DialogTitle>
                {dialog === 'decline' ? 'Rechazar reserva' : 'Cancelar reserva'}
              </DialogTitle>
              <DialogDescription>
                Le enviaremos el motivo a {reservation.contact_name}.
              </DialogDescription>
            </DialogHeader>
            <div className="flex flex-wrap gap-2">
              {DECLINE_REASONS.map((option) => (
                <button
                  key={option}
                  type="button"
                  onClick={() => setReason(option)}
                  aria-pressed={reason === option}
                  className={cn(
                    'rounded-pill border-border h-9 border px-3 text-sm',
                    reason === option
                      ? 'border-primary bg-primary/10 text-primary-on-tint'
                      : 'hover:bg-muted',
                  )}
                >
                  {option}
                </button>
              ))}
            </div>
            <Textarea
              aria-label="Motivo"
              value={reason}
              maxLength={200}
              placeholder="O escribe el motivo"
              onChange={(event) => setReason(event.target.value)}
            />
            <DialogFooter>
              <Button
                variant="ghost"
                onClick={() => setDialog(null)}
                disabled={pending}
              >
                Volver
              </Button>
              <Button
                variant="destructive"
                disabled={pending || reason.trim().length === 0}
                onClick={() => run(dialog, reason)}
              >
                {dialog === 'decline' ? 'Rechazar' : 'Cancelar reserva'}
              </Button>
            </DialogFooter>
          </DialogContent>
        ) : null}
      </Dialog>
    </article>
  )
}
