'use client'

import { LoaderCircleIcon } from 'lucide-react'
import { useRouter } from 'next/navigation'
import { useTransition } from 'react'
import { toast } from 'sonner'
import { cancelMyReservation } from '@/app/(protected)/account/reservas/actions'
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

export function CancelReservationButton({
  reservationId,
  storeName,
}: {
  reservationId: string
  storeName: string
}) {
  const router = useRouter()
  const [pending, startTransition] = useTransition()

  const cancel = () => {
    startTransition(async () => {
      const result = await cancelMyReservation(reservationId)
      if (!result.ok) {
        toast.error(result.error)
        router.refresh()
        return
      }
      toast.success('Reserva cancelada. Le avisamos al restaurante.')
      router.refresh()
    })
  }

  return (
    <AlertDialog>
      <AlertDialogTrigger asChild>
        <Button
          variant="outline"
          size="sm"
          disabled={pending}
          className="rounded-pill h-10"
        >
          {pending ? (
            <LoaderCircleIcon aria-hidden="true" className="animate-spin" />
          ) : null}
          Cancelar reserva
        </Button>
      </AlertDialogTrigger>
      <AlertDialogContent>
        <AlertDialogHeader>
          <AlertDialogTitle>¿Cancelar tu reserva?</AlertDialogTitle>
          <AlertDialogDescription>
            {storeName} liberará tu mesa para otras personas.
          </AlertDialogDescription>
        </AlertDialogHeader>
        <AlertDialogFooter>
          <AlertDialogCancel>Mantener</AlertDialogCancel>
          <AlertDialogAction onClick={cancel}>Sí, cancelar</AlertDialogAction>
        </AlertDialogFooter>
      </AlertDialogContent>
    </AlertDialog>
  )
}
