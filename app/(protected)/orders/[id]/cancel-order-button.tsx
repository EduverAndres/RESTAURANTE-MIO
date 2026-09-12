'use client'

import { LoaderCircleIcon } from 'lucide-react'
import { useRouter } from 'next/navigation'
import { useState, useTransition } from 'react'
import { toast } from 'sonner'
import { cancelOrder } from './actions'
import { Button } from '@/components/ui/button'
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from '@/components/ui/dialog'

export function CancelOrderButton({ orderId }: { orderId: string }) {
  const router = useRouter()
  const [open, setOpen] = useState(false)
  const [pending, startTransition] = useTransition()

  function confirm() {
    startTransition(async () => {
      const result = await cancelOrder(orderId)
      if (!result.ok) {
        toast.error(result.error)
        setOpen(false)
        return
      }
      toast.success('Pedido cancelado.')
      setOpen(false)
      router.refresh()
    })
  }

  return (
    <Dialog open={open} onOpenChange={setOpen}>
      <DialogTrigger asChild>
        <Button variant="outline" className="rounded-pill text-destructive">
          Cancelar pedido
        </Button>
      </DialogTrigger>
      <DialogContent className="rounded-card">
        <DialogHeader>
          <DialogTitle className="font-display text-2xl">
            ¿Cancelar el pedido?
          </DialogTitle>
          <DialogDescription>
            Solo es posible mientras el restaurante no lo haya aceptado. Si ya
            pagaste, el reembolso se gestiona con el restaurante.
          </DialogDescription>
        </DialogHeader>
        <DialogFooter className="gap-2">
          <Button
            variant="ghost"
            className="rounded-pill"
            onClick={() => setOpen(false)}
          >
            Mantener pedido
          </Button>
          <Button
            variant="destructive"
            className="rounded-pill"
            onClick={confirm}
            disabled={pending}
          >
            {pending ? (
              <LoaderCircleIcon aria-hidden="true" className="animate-spin" />
            ) : null}
            Sí, cancelar
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  )
}
