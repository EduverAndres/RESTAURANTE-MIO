'use client'

import { LoaderCircleIcon } from 'lucide-react'
import { useRouter } from 'next/navigation'
import { useState, useTransition } from 'react'
import { toast } from 'sonner'
import { setCourierStatus } from '@/app/admin/actions'
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
import type { CourierStatus } from '@/lib/couriers/vocabulary'

type NotedAction = Exclude<CourierStatus, 'approved'>

const NOTED_COPY: Record<
  NotedAction,
  { title: string; description: string; confirm: string }
> = {
  pending: {
    title: 'Pedir cambios',
    description:
      'El perfil vuelve a revisión y el domiciliario recibe tu mensaje. Dile qué corregir.',
    confirm: 'Enviar a revisión',
  },
  suspended: {
    title: 'Suspender domiciliario',
    description:
      'Deja de ver la bolsa de pedidos al instante. Los pedidos que ya tiene asignados los puede terminar.',
    confirm: 'Suspender',
  },
}

/** Approve, send back or suspend one courier. */
export function CourierReviewActions({
  userId,
  name,
  status,
  hasProfile,
}: {
  userId: string
  name: string
  status: CourierStatus | null
  hasProfile: boolean
}) {
  const router = useRouter()
  const [pending, startTransition] = useTransition()
  const [dialog, setDialog] = useState<NotedAction | null>(null)
  const [note, setNote] = useState('')

  const run = (next: CourierStatus, reason: string) => {
    startTransition(async () => {
      const result = await setCourierStatus({
        userId,
        status: next,
        note: reason,
      })
      if (!result.ok) {
        toast.error(result.error)
        return
      }
      toast.success(
        next === 'approved'
          ? `${name} ya puede tomar pedidos.`
          : next === 'suspended'
            ? `${name} quedó suspendido.`
            : `Le pedimos cambios a ${name}.`,
      )
      setDialog(null)
      setNote('')
      router.refresh()
    })
  }

  if (!hasProfile) {
    return (
      <span className="text-muted-foreground text-xs">Sin perfil enviado</span>
    )
  }

  return (
    <div className="flex flex-wrap justify-end gap-2">
      {status !== 'approved' ? (
        <Button
          size="sm"
          className="rounded-pill"
          disabled={pending}
          onClick={() => run('approved', '')}
        >
          {pending ? (
            <LoaderCircleIcon aria-hidden="true" className="animate-spin" />
          ) : null}
          {status === 'suspended' ? 'Reactivar' : 'Aprobar'}
        </Button>
      ) : null}
      {status === 'approved' ? (
        <Button
          size="sm"
          variant="outline"
          className="rounded-pill"
          disabled={pending}
          onClick={() => setDialog('pending')}
        >
          Pedir cambios
        </Button>
      ) : null}
      {status !== 'suspended' ? (
        <Button
          size="sm"
          variant="ghost"
          className="rounded-pill text-destructive"
          disabled={pending}
          onClick={() => setDialog('suspended')}
        >
          Suspender
        </Button>
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
              <DialogTitle>{NOTED_COPY[dialog].title}</DialogTitle>
              <DialogDescription>
                {NOTED_COPY[dialog].description}
              </DialogDescription>
            </DialogHeader>
            <div className="space-y-1.5">
              <Label htmlFor={`courier-note-${userId}`}>Motivo</Label>
              <Textarea
                id={`courier-note-${userId}`}
                value={note}
                maxLength={300}
                onChange={(event) => setNote(event.target.value)}
                className="min-h-24"
              />
            </div>
            <DialogFooter>
              <Button
                variant="ghost"
                onClick={() => setDialog(null)}
                disabled={pending}
              >
                Cancelar
              </Button>
              <Button
                variant={dialog === 'suspended' ? 'destructive' : 'default'}
                disabled={pending || note.trim().length === 0}
                onClick={() => run(dialog, note)}
              >
                {pending ? (
                  <LoaderCircleIcon
                    aria-hidden="true"
                    className="animate-spin"
                  />
                ) : null}
                {NOTED_COPY[dialog].confirm}
              </Button>
            </DialogFooter>
          </DialogContent>
        ) : null}
      </Dialog>
    </div>
  )
}
