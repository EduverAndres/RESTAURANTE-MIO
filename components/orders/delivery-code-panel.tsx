'use client'

import { KeyRoundIcon, LoaderCircleIcon } from 'lucide-react'
import { useRouter } from 'next/navigation'
import { useTransition } from 'react'
import { toast } from 'sonner'
import { confirmDelivery } from '@/app/(protected)/orders/[id]/actions'
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
  AlertDialogTrigger,
} from '@/components/ui/alert-dialog'
import { Button } from '@/components/ui/button'

interface DeliveryCodePanelProps {
  orderId: string
  /** Four digits; the panel is not rendered without one. */
  code: string
}

/**
 * The handover code, shown large enough to read across a doorstep, and the
 * customer's own way out: confirming receipt themselves when the courier
 * cannot type it in.
 */
export function DeliveryCodePanel({ orderId, code }: DeliveryCodePanelProps) {
  const router = useRouter()
  const [pending, startTransition] = useTransition()

  function confirm() {
    startTransition(async () => {
      const result = await confirmDelivery(orderId)
      if (!result.ok) {
        toast.error(result.error)
        router.refresh()
        return
      }
      toast.success('Entrega confirmada. ¡Buen provecho!')
      router.refresh()
    })
  }

  return (
    <section
      aria-labelledby="delivery-code-title"
      className="rounded-card border-border bg-card shadow-1 p-card space-y-4 border"
    >
      <div className="flex items-center gap-2">
        <KeyRoundIcon aria-hidden="true" className="text-primary size-5" />
        <h2
          id="delivery-code-title"
          className="text-h3 font-display font-semibold"
        >
          Código de entrega
        </h2>
      </div>
      <p
        className="font-display text-primary text-center text-5xl font-semibold tracking-[0.35em]"
        aria-label={`Código de entrega: ${code.split('').join(' ')}`}
      >
        {code}
      </p>
      <p className="text-muted-foreground text-center text-sm">
        Dáselo al domiciliario cuando llegue. Con él confirma que recibiste tu
        pedido.
      </p>
      <AlertDialog>
        <AlertDialogTrigger asChild>
          <Button
            type="button"
            variant="outline"
            disabled={pending}
            className="rounded-pill w-full"
          >
            {pending ? (
              <LoaderCircleIcon aria-hidden="true" className="animate-spin" />
            ) : null}
            Ya lo recibí
          </Button>
        </AlertDialogTrigger>
        <AlertDialogContent className="rounded-card">
          <AlertDialogHeader>
            <AlertDialogTitle className="font-display text-2xl">
              ¿Ya tienes tu pedido?
            </AlertDialogTitle>
            <AlertDialogDescription>
              Confirma solo si el domiciliario ya te entregó el pedido. El
              pedido pasará a entregado y esta acción no se puede deshacer.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel className="rounded-pill">
              Todavía no
            </AlertDialogCancel>
            <AlertDialogAction
              onClick={confirm}
              className="rounded-pill bg-success hover:bg-success/90 text-success-foreground"
            >
              Sí, lo recibí
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </section>
  )
}
