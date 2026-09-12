'use client'

import { LoaderCircleIcon } from 'lucide-react'
import { Button } from '@/components/ui/button'
import type { MerchantAction } from '@/lib/orders/status'
import { cn } from '@/lib/utils'

interface OrderActionsProps {
  actions: readonly MerchantAction[]
  pending: boolean
  onAction: (action: MerchantAction) => void
}

const TONE_CLASSES: Record<MerchantAction['tone'], string> = {
  primary: '',
  success: 'bg-success text-success-foreground hover:bg-success/90',
  destructive: '',
  info: '',
  neutral: '',
  warning: '',
}

/**
 * The transition buttons on a card.
 *
 * Purely presentational since Phase 5: the card above owns the action list,
 * the confirmation dialog and the keyboard shortcuts, so a move made from a
 * button, from the card menu and from the `A`/`L` keys all travel the same
 * path and confirm the same way.
 */
export function OrderActions({
  actions,
  pending,
  onAction,
}: OrderActionsProps) {
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
            onClick={() => onAction(action)}
          >
            {pending && !destructive ? (
              <LoaderCircleIcon aria-hidden="true" className="animate-spin" />
            ) : null}
            {action.label}
          </Button>
        )
      })}
    </div>
  )
}
