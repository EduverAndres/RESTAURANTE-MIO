'use client'

import { LoaderCircleIcon } from 'lucide-react'
import { useState } from 'react'
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
} from '@/components/ui/alert-dialog'
import { Button } from '@/components/ui/button'
import { nextMerchantActions, type MerchantAction } from '@/lib/orders/status'
import { cn } from '@/lib/utils'
import type { OrderStatus, OrderType } from '@/types/app'

interface OrderActionsProps {
  shortCode: string
  status: OrderStatus
  type: OrderType
  pending: boolean
  onTransition: (to: OrderStatus) => void
}

const TONE_CLASSES: Record<MerchantAction['tone'], string> = {
  primary: '',
  success: 'bg-success text-success-foreground hover:bg-success/90',
  destructive: '',
  info: '',
  neutral: '',
  warning: '',
}

/** Action buttons derived from the transition map; cancel asks first. */
export function OrderActions({
  shortCode,
  status,
  type,
  pending,
  onTransition,
}: OrderActionsProps) {
  const [confirming, setConfirming] = useState<MerchantAction | null>(null)
  const actions = nextMerchantActions(status, type)
  if (actions.length === 0) return null

  return (
    <div className="flex flex-wrap items-center gap-2">
      {actions.map((action) => {
        const destructive = action.tone === 'destructive'
        return (
          <Button
            key={action.to}
            type="button"
            size="sm"
            variant={destructive ? 'ghost' : 'default'}
            disabled={pending}
            className={cn(
              'rounded-pill',
              destructive && 'text-destructive hover:bg-destructive/10',
              !destructive && TONE_CLASSES[action.tone],
              !destructive && 'flex-1',
            )}
            onClick={() =>
              destructive ? setConfirming(action) : onTransition(action.to)
            }
          >
            {pending && !destructive ? (
              <LoaderCircleIcon aria-hidden="true" className="animate-spin" />
            ) : null}
            {action.label}
          </Button>
        )
      })}

      <AlertDialog
        open={confirming !== null}
        onOpenChange={(open) => {
          if (!open) setConfirming(null)
        }}
      >
        <AlertDialogContent className="rounded-card">
          <AlertDialogHeader>
            <AlertDialogTitle className="font-display text-xl">
              {status === 'pending' ? 'Rechazar' : 'Cancelar'} el pedido #
              {shortCode}
            </AlertDialogTitle>
            <AlertDialogDescription>
              El cliente recibirá la notificación al instante y no podrás
              deshacerlo.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel className="rounded-pill">
              Volver
            </AlertDialogCancel>
            <AlertDialogAction
              className="rounded-pill bg-destructive hover:bg-destructive/90 text-white"
              onClick={() => {
                if (confirming) onTransition(confirming.to)
                setConfirming(null)
              }}
            >
              Sí, {status === 'pending' ? 'rechazar' : 'cancelar'}
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </div>
  )
}
