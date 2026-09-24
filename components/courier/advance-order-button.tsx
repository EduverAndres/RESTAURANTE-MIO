'use client'

import { LoaderCircleIcon } from 'lucide-react'
import { useRouter } from 'next/navigation'
import { useId, useState, useTransition } from 'react'
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
import { Input } from '@/components/ui/input'
import { nextCourierAction } from '@/lib/orders/status'
import { deliveryCodeSchema } from '@/lib/tracking/delivery-code'
import { cn } from '@/lib/utils'
import type { OrderStatus, OrderType } from '@/types/app'

interface AdvanceOrderButtonProps {
  orderId: string
  status: OrderStatus
  /** Deliveries need the customer's code to be marked delivered. */
  orderType: OrderType
  className?: string
}

const SUCCESS_COPY: Partial<Record<OrderStatus, string>> = {
  picked_up: 'Pedido recogido. ¡Buen viaje!',
  delivered: 'Entrega confirmada.',
}
const NETWORK_FAILED =
  'No se pudo enviar. Revisa tu conexión e inténtalo de nuevo.'

/** Single "next step" button for a courier order; hidden when there is none. */
export function AdvanceOrderButton({
  orderId,
  status,
  orderType,
  className,
}: AdvanceOrderButtonProps) {
  const router = useRouter()
  const [pending, startTransition] = useTransition()
  const [open, setOpen] = useState(false)
  const [code, setCode] = useState('')
  const [codeError, setCodeError] = useState<string | null>(null)
  const inputId = useId()
  const errorId = useId()
  const action = nextCourierAction(status)
  if (!action) return null

  const needsCode = action.to === 'delivered' && orderType === 'delivery'

  function run(input?: { code: string }) {
    if (!action) return
    startTransition(async () => {
      let result: Awaited<ReturnType<typeof advanceOrder>>
      try {
        result = await advanceOrder(orderId, action.to, input)
      } catch {
        // The action never resolves on a dropped connection; the order is
        // untouched and the courier just retries.
        toast.error(NETWORK_FAILED)
        return
      }
      if (!result.ok) {
        if (input) {
          // A wrong code is answered inside the dialog, not as a toast the
          // courier has to read while the dialog is still open.
          setCodeError(result.error)
          return
        }
        toast.error(result.error)
        router.refresh()
        return
      }
      setOpen(false)
      setCode('')
      setCodeError(null)
      toast.success(SUCCESS_COPY[action.to] ?? 'Pedido actualizado.')
      router.refresh()
    })
  }

  function submitCode() {
    const parsed = deliveryCodeSchema.safeParse(code)
    if (!parsed.success) {
      setCodeError(
        parsed.error.issues[0]?.message ?? 'Ingresa los 4 dígitos del código.',
      )
      return
    }
    run({ code: parsed.data })
  }

  const button = (
    <Button
      type="button"
      disabled={pending}
      onClick={action.to === 'delivered' ? undefined : () => run()}
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
    <AlertDialog
      open={open}
      onOpenChange={(next) => {
        if (pending) return
        setOpen(next)
        if (!next) {
          setCode('')
          setCodeError(null)
        }
      }}
    >
      <AlertDialogTrigger asChild>{button}</AlertDialogTrigger>
      <AlertDialogContent className="rounded-card">
        <AlertDialogHeader>
          <AlertDialogTitle className="font-display text-2xl">
            ¿Confirmas la entrega?
          </AlertDialogTitle>
          <AlertDialogDescription>
            {needsCode
              ? 'Pídele al cliente su código de entrega de 4 dígitos. Con él el pedido pasa a tu historial; esta acción no se puede deshacer.'
              : 'El cliente recibirá la confirmación y el pedido pasará a tu historial. Esta acción no se puede deshacer.'}
          </AlertDialogDescription>
        </AlertDialogHeader>
        {needsCode ? (
          <form
            onSubmit={(event) => {
              event.preventDefault()
              submitCode()
            }}
            className="space-y-2"
          >
            <label htmlFor={inputId} className="text-sm font-medium">
              Código de entrega
            </label>
            <Input
              id={inputId}
              value={code}
              onChange={(event) => {
                setCode(event.target.value.replace(/\D/g, '').slice(0, 4))
                setCodeError(null)
              }}
              inputMode="numeric"
              autoComplete="one-time-code"
              pattern="[0-9]*"
              maxLength={4}
              placeholder="0000"
              autoFocus
              disabled={pending}
              aria-invalid={codeError ? true : undefined}
              aria-describedby={codeError ? errorId : undefined}
              className="h-14 text-center font-mono text-3xl tracking-[0.5em]"
            />
            {codeError ? (
              <p id={errorId} role="alert" className="text-destructive text-sm">
                {codeError}
              </p>
            ) : null}
          </form>
        ) : null}
        <AlertDialogFooter>
          <AlertDialogCancel className="rounded-pill" disabled={pending}>
            Todavía no
          </AlertDialogCancel>
          <AlertDialogAction
            disabled={pending || (needsCode && code.length !== 4)}
            onClick={(event) => {
              // Keep the dialog open until the server answers: a wrong code
              // is shown inline and the courier tries again.
              event.preventDefault()
              if (needsCode) submitCode()
              else run()
            }}
            className="rounded-pill bg-success hover:bg-success/90 text-success-foreground"
          >
            {pending ? (
              <LoaderCircleIcon aria-hidden="true" className="animate-spin" />
            ) : null}
            {needsCode ? 'Confirmar entrega' : 'Sí, entregado'}
          </AlertDialogAction>
        </AlertDialogFooter>
      </AlertDialogContent>
    </AlertDialog>
  )
}
