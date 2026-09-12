'use client'

import { LoaderCircleIcon } from 'lucide-react'
import { useRouter } from 'next/navigation'
import { useTransition } from 'react'
import { toast } from 'sonner'
import { advanceOrder } from '@/app/courier/actions'
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
import { nextCourierAction } from '@/lib/orders/status'
import { cn } from '@/lib/utils'
import type { OrderStatus } from '@/types/app'

interface AdvanceOrderButtonProps {
  orderId: string
  status: OrderStatus
  className?: string
}

const SUCCESS_COPY: Partial<Record<OrderStatus, string>> = {
  picked_up: 'Pedido recogido. ¡Buen viaje!',
  delivered: 'Entrega confirmada.',
}

/** Single "next step" button for a courier order; hidden when there is none. */
export function AdvanceOrderButton({
  orderId,
  status,
  className,
}: AdvanceOrderButtonProps) {
  const router = useRouter()
  const [pending, startTransition] = useTransition()
  const action = nextCourierAction(status)
  if (!action) return null

  function run() {
    if (!action) return
    startTransition(async () => {
      const result = await advanceOrder(orderId, action.to)
      if (!result.ok) {
        toast.error(result.error)
        router.refresh()
        return
      }
      toast.success(SUCCESS_COPY[action.to] ?? 'Pedido actualizado.')
      router.refresh()
    })
  }

  const button = (
    <Button
      type="button"
      disabled={pending}
      onClick={action.to === 'delivered' ? undefined : run}
      className={cn(
        'rounded-pill',
        action.tone === 'success' &&
          'bg-success hover:bg-success/90 text-success-foreground',
        className,
      )}
    >
      {pending ? (
        <LoaderCircleIcon aria-hidden="true" className="animate-spin" />
      ) : null}
      {action.label}
    </Button>
  )

  if (action.to !== 'delivered') return button

  return (
    <AlertDialog>
      <AlertDialogTrigger asChild>{button}</AlertDialogTrigger>
      <AlertDialogContent className="rounded-card">
        <AlertDialogHeader>
          <AlertDialogTitle className="font-display text-2xl">
            ¿Confirmas la entrega?
          </AlertDialogTitle>
          <AlertDialogDescription>
            El cliente recibirá la confirmación y el pedido pasará a tu
            historial. Esta acción no se puede deshacer.
          </AlertDialogDescription>
        </AlertDialogHeader>
        <AlertDialogFooter>
          <AlertDialogCancel className="rounded-pill">
            Todavía no
          </AlertDialogCancel>
          <AlertDialogAction
            onClick={run}
            className="rounded-pill bg-success hover:bg-success/90 text-success-foreground"
          >
            Sí, entregado
          </AlertDialogAction>
        </AlertDialogFooter>
      </AlertDialogContent>
    </AlertDialog>
  )
}
