'use client'

import { LoaderCircleIcon } from 'lucide-react'
import { useRouter } from 'next/navigation'
import { useState, useTransition } from 'react'
import { toast } from 'sonner'
import {
  approveAdCampaign,
  rejectAdCampaign,
  setAdCampaignStatus,
} from '@/app/admin/publicidad/actions'
import { ConfirmDeleteDialog } from '@/components/dashboard/menu/confirm-delete-dialog'
import { Button } from '@/components/ui/button'
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog'
import { Label } from '@/components/ui/label'
import { Textarea } from '@/components/ui/textarea'
import type { AdStatus } from '@/lib/ads/vocabulary'

const REJECT_REASONS = [
  'No hay cupo en esas fechas',
  'Las fechas ya pasaron',
  'La tienda no cumple las condiciones para anunciarse',
] as const

type Result = { ok: true } | { ok: false; error: string }

/**
 * What an admin can do with one campaign: decide a request, or pause,
 * resume and end an approved one. Every move is a compare-and-set on the
 * server, so two admins acting at once cannot both win.
 */
export function AdReviewActions({
  campaignId,
  storeName,
  status,
}: {
  campaignId: string
  storeName: string
  status: AdStatus
}) {
  const router = useRouter()
  const [pending, startTransition] = useTransition()
  const [rejecting, setRejecting] = useState(false)
  const [ending, setEnding] = useState(false)
  const [reason, setReason] = useState('')

  const run = (action: () => Promise<Result>, success: string) => {
    startTransition(async () => {
      const result = await action()
      if (!result.ok) {
        toast.error(result.error)
        return
      }
      toast.success(success)
      setRejecting(false)
      setEnding(false)
      setReason('')
      router.refresh()
    })
  }

  const spinner = pending ? (
    <LoaderCircleIcon aria-hidden="true" className="animate-spin" />
  ) : null

  if (status === 'requested') {
    return (
      <div className="flex flex-wrap justify-end gap-2">
        <Button
          size="sm"
          className="rounded-pill"
          disabled={pending}
          aria-label={`Aprobar la campaña de ${storeName}`}
          onClick={() =>
            run(
              () => approveAdCampaign({ campaignId }),
              `Campaña de ${storeName} aprobada.`,
            )
          }
        >
          {spinner}
          Aprobar
        </Button>
        <Button
          size="sm"
          variant="ghost"
          className="rounded-pill text-destructive"
          disabled={pending}
          aria-label={`Rechazar la campaña de ${storeName}`}
          onClick={() => setRejecting(true)}
        >
          Rechazar
        </Button>

        <Dialog open={rejecting} onOpenChange={setRejecting}>
          <DialogContent>
            <DialogHeader>
              <DialogTitle>Rechazar la campaña</DialogTitle>
              <DialogDescription>
                {storeName} recibe el motivo y no se le cobra nada.
              </DialogDescription>
            </DialogHeader>
            <div className="flex flex-wrap gap-2">
              {REJECT_REASONS.map((option) => (
                <Button
                  key={option}
                  type="button"
                  size="sm"
                  variant={reason === option ? 'default' : 'outline'}
                  className="rounded-pill h-auto py-1.5 whitespace-normal"
                  aria-pressed={reason === option}
                  onClick={() => setReason(option)}
                >
                  {option}
                </Button>
              ))}
            </div>
            <div className="space-y-1.5">
              <Label htmlFor={`ad-reject-${campaignId}`}>Motivo</Label>
              <Textarea
                id={`ad-reject-${campaignId}`}
                value={reason}
                maxLength={300}
                onChange={(event) => setReason(event.target.value)}
                className="min-h-24"
              />
            </div>
            <DialogFooter>
              <Button
                variant="ghost"
                disabled={pending}
                onClick={() => setRejecting(false)}
              >
                Volver
              </Button>
              <Button
                variant="destructive"
                disabled={pending || reason.trim().length < 3}
                onClick={() =>
                  run(
                    () => rejectAdCampaign({ campaignId, reason }),
                    `Campaña de ${storeName} rechazada.`,
                  )
                }
              >
                {spinner}
                Rechazar
              </Button>
            </DialogFooter>
          </DialogContent>
        </Dialog>
      </div>
    )
  }

  if (status !== 'active' && status !== 'paused') return null

  return (
    <div className="flex flex-wrap justify-end gap-2">
      {status === 'active' ? (
        <Button
          size="sm"
          variant="outline"
          className="rounded-pill"
          disabled={pending}
          aria-label={`Pausar la campaña de ${storeName}`}
          onClick={() =>
            run(
              () => setAdCampaignStatus({ campaignId, action: 'pause' }),
              'Campaña pausada: desde hoy no se cobra.',
            )
          }
        >
          {spinner}
          Pausar
        </Button>
      ) : (
        <Button
          size="sm"
          variant="outline"
          className="rounded-pill"
          disabled={pending}
          aria-label={`Reanudar la campaña de ${storeName}`}
          onClick={() =>
            run(
              () => setAdCampaignStatus({ campaignId, action: 'resume' }),
              'Campaña reanudada.',
            )
          }
        >
          {spinner}
          Reanudar
        </Button>
      )}
      <Button
        size="sm"
        variant="ghost"
        className="rounded-pill text-destructive"
        disabled={pending}
        aria-label={`Terminar la campaña de ${storeName}`}
        onClick={() => setEnding(true)}
      >
        Terminar
      </Button>
      <ConfirmDeleteDialog
        open={ending}
        onOpenChange={setEnding}
        title="¿Terminar la campaña?"
        description={`Sale del aire de inmediato y no vuelve. A ${storeName} se le cobran solo los días que corrió antes de hoy.`}
        confirmLabel="Sí, terminar"
        onConfirm={() =>
          run(
            () => setAdCampaignStatus({ campaignId, action: 'end' }),
            'Campaña terminada.',
          )
        }
      />
    </div>
  )
}
