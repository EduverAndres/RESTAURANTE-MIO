'use client'

import { LoaderCircleIcon } from 'lucide-react'
import { useRouter } from 'next/navigation'
import { useState, useTransition } from 'react'
import { toast } from 'sonner'
import { cancelAdRequest } from '@/app/dashboard/publicidad/actions'
import { ConfirmDeleteDialog } from '@/components/dashboard/menu/confirm-delete-dialog'
import { Button } from '@/components/ui/button'

/** Withdraws a request that is still waiting for approval. */
export function CancelAdRequestButton({ campaignId }: { campaignId: string }) {
  const router = useRouter()
  const [open, setOpen] = useState(false)
  const [pending, startTransition] = useTransition()

  const confirm = () => {
    startTransition(async () => {
      const result = await cancelAdRequest({ campaignId })
      if (!result.ok) {
        toast.error(result.error)
        return
      }
      toast.success('Solicitud cancelada.')
      setOpen(false)
      router.refresh()
    })
  }

  return (
    <>
      <Button
        variant="outline"
        size="sm"
        className="rounded-pill"
        disabled={pending}
        onClick={() => setOpen(true)}
      >
        {pending ? (
          <LoaderCircleIcon aria-hidden="true" className="animate-spin" />
        ) : null}
        Cancelar solicitud
      </Button>
      <ConfirmDeleteDialog
        open={open}
        onOpenChange={setOpen}
        title="¿Cancelar la solicitud?"
        description="La campaña no saldrá al aire y no se cobra nada. Puedes pedir otra cuando quieras."
        confirmLabel="Sí, cancelar"
        onConfirm={confirm}
      />
    </>
  )
}
