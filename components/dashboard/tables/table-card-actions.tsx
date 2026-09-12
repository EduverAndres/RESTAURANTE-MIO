'use client'

import { LoaderCircleIcon, RefreshCwIcon, Trash2Icon } from 'lucide-react'
import { useRouter } from 'next/navigation'
import { useState, useTransition } from 'react'
import { toast } from 'sonner'
import { deleteTable, regenerateTableToken } from '@/app/dashboard/tables/actions'
import { ConfirmDeleteDialog } from '@/components/dashboard/menu/confirm-delete-dialog'
import { Button } from '@/components/ui/button'

interface TableCardActionsProps {
  tableId: string
  number: number
}

type Confirm = 'delete' | 'regenerate' | null

export function TableCardActions({ tableId, number }: TableCardActionsProps) {
  const router = useRouter()
  const [confirm, setConfirm] = useState<Confirm>(null)
  const [pending, startTransition] = useTransition()

  function run(action: () => Promise<{ ok: boolean; error?: string }>, done: string) {
    startTransition(async () => {
      const result = await action()
      if (!result.ok) {
        toast.error(result.error ?? 'No pudimos guardar los cambios.')
        return
      }
      toast.success(done)
      router.refresh()
    })
  }

  return (
    <>
      <div className="flex w-full gap-2">
        <Button
          type="button"
          variant="outline"
          size="sm"
          className="rounded-pill flex-1"
          disabled={pending}
          onClick={() => setConfirm('regenerate')}
        >
          {pending ? (
            <LoaderCircleIcon aria-hidden="true" className="animate-spin" />
          ) : (
            <RefreshCwIcon aria-hidden="true" />
          )}
          Nuevo QR
        </Button>
        <Button
          type="button"
          variant="ghost"
          size="sm"
          className="rounded-pill text-destructive hover:text-destructive"
          aria-label={`Eliminar mesa ${number}`}
          disabled={pending}
          onClick={() => setConfirm('delete')}
        >
          <Trash2Icon aria-hidden="true" />
        </Button>
      </div>

      <ConfirmDeleteDialog
        open={confirm === 'delete'}
        onOpenChange={(open) => setConfirm(open ? 'delete' : null)}
        title={`¿Eliminar la mesa ${number}?`}
        description="El código QR impreso dejará de funcionar. Los pedidos ya creados no se borran."
        onConfirm={() =>
          run(() => deleteTable(tableId), `Mesa ${number} eliminada.`)
        }
      />
      <ConfirmDeleteDialog
        open={confirm === 'regenerate'}
        onOpenChange={(open) => setConfirm(open ? 'regenerate' : null)}
        title={`¿Generar un nuevo QR para la mesa ${number}?`}
        description="El código actual dejará de funcionar de inmediato. Tendrás que imprimir el nuevo."
        confirmLabel="Sí, generar nuevo"
        onConfirm={() =>
          run(
            () => regenerateTableToken(tableId),
            `Nuevo código listo para la mesa ${number}.`,
          )
        }
      />
    </>
  )
}
