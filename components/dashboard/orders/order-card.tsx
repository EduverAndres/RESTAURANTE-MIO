'use client'

import { ClockIcon, StickyNoteIcon, UserRoundIcon } from 'lucide-react'
import { useState, type KeyboardEvent } from 'react'
import { OrderActions } from '@/components/dashboard/orders/order-actions'
import { OrderCardMenu } from '@/components/dashboard/orders/order-card-menu'
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
import { Badge } from '@/components/ui/badge'
import {
  KANBAN_SHORTCUTS,
  isTypingTarget,
  shortcutAction,
} from '@/lib/a11y/kanban-shortcuts'
import { formatCOP } from '@/lib/format'
import {
  ELAPSED_TONE_LABELS,
  orderElapsedTone,
  type ElapsedTone,
} from '@/lib/orders/elapsed-tone'
import {
  elapsedLabel,
  itemsSummary,
  type BoardOrder,
} from '@/lib/orders/kanban'
import {
  ORDER_TYPE_LABELS,
  nextMerchantActions,
  type MerchantAction,
} from '@/lib/orders/status'
import { cn } from '@/lib/utils'
import type { OrderStatus } from '@/types/app'

interface OrderCardProps {
  order: BoardOrder
  now: Date
  pending: boolean
  onTransition: (orderId: string, to: OrderStatus) => void
}

/**
 * Time as colour.
 *
 * Nobody in a kitchen reads "hace 12 min" on twenty cards; everybody sees
 * that one card is red. The minutes stay for the person who then looks. The
 * tone is never the only cue: an amber or red card also carries the words
 * "Va justo" / "Con retraso", so the board still works in greyscale, under a
 * high-contrast preference, and for the one cook in twelve who is colour
 * blind.
 */
const CARD_TONES: Record<ElapsedTone, string> = {
  fresh: 'border-border',
  warn: 'border-accent/60 bg-accent/6',
  late: 'border-destructive/60 bg-destructive/6',
}

const DOT_TONES: Record<ElapsedTone, string> = {
  fresh: 'bg-success',
  warn: 'bg-accent',
  late: 'bg-destructive',
}

const CLOCK_TONES: Record<ElapsedTone, string> = {
  fresh: 'text-muted-foreground',
  warn: 'text-foreground font-medium',
  late: 'text-destructive-on-tint font-semibold',
}

/** `A L`, or just the keys this order can actually use right now. */
function keyShortcuts(actions: readonly MerchantAction[]): string | undefined {
  const keys = Object.entries(KANBAN_SHORTCUTS)
    .filter(([, to]) => actions.some((action) => action.to === to))
    .map(([key]) => key.toUpperCase())
  return keys.length > 0 ? keys.join(' ') : undefined
}

export function OrderCard({
  order,
  now,
  pending,
  onTransition,
}: OrderCardProps) {
  const [confirming, setConfirming] = useState<MerchantAction | null>(null)
  const actions = nextMerchantActions(order.status, order.type)
  const tone = orderElapsedTone(order.status, order.created_at, now)

  /** Destructive moves always ask first, whatever triggered them. */
  function run(action: MerchantAction) {
    if (action.tone === 'destructive') setConfirming(action)
    else onTransition(order.id, action.to)
  }

  /**
   * Shortcuts are bound to the card, never to `document`: a merchant typing
   * "arepa" into the menu search two panels away must not accept an order.
   * `isTypingTarget` is the second guard, for text controls nested inside a
   * card, and a modifier key means the keystroke belongs to the browser.
   */
  function onKeyDown(event: KeyboardEvent<HTMLElement>) {
    if (
      pending ||
      event.repeat ||
      event.defaultPrevented ||
      event.altKey ||
      event.ctrlKey ||
      event.metaKey ||
      isTypingTarget(event.target)
    ) {
      return
    }
    const action = shortcutAction(event.key, actions)
    if (!action) return
    event.preventDefault()
    run(action)
  }

  return (
    <article
      // Focusable so every card is one Tab stop: reach the card, then use the
      // actions menu or a shortcut, instead of tabbing through every button
      // of every card to get to the one you want.
      tabIndex={0}
      aria-label={`Pedido #${order.short_code}`}
      aria-keyshortcuts={keyShortcuts(actions)}
      aria-busy={pending || undefined}
      onKeyDown={onKeyDown}
      className={cn(
        'rounded-card bg-card shadow-1 space-y-3 border p-4 transition-colors',
        CARD_TONES[tone],
      )}
    >
      <header className="flex items-start justify-between gap-2">
        <div className="min-w-0 space-y-1">
          <p className="flex items-center gap-1.5 font-mono text-sm font-semibold">
            <span
              aria-hidden="true"
              className={cn('size-2 shrink-0 rounded-full', DOT_TONES[tone])}
            />
            #{order.short_code}
          </p>
          <div className="flex flex-wrap items-center gap-1">
            <Badge variant="outline" className="rounded-pill text-[10px]">
              {ORDER_TYPE_LABELS[order.type]}
              {order.type === 'table' && order.table_number
                ? ` ${order.table_number}`
                : ''}
            </Badge>
            {tone === 'fresh' ? null : (
              <Badge
                variant="outline"
                className={cn(
                  'rounded-pill border-transparent text-[10px] font-semibold',
                  tone === 'late'
                    ? 'bg-destructive/12 text-destructive-on-tint'
                    : 'bg-accent/20 text-foreground',
                )}
              >
                {ELAPSED_TONE_LABELS[tone]}
              </Badge>
            )}
          </div>
        </div>
        <div className="flex shrink-0 items-center gap-1">
          <p
            className={cn('flex items-center gap-1 text-xs', CLOCK_TONES[tone])}
          >
            <ClockIcon aria-hidden="true" className="size-3.5" />
            {elapsedLabel(order.created_at, now)}
          </p>
          <OrderCardMenu
            shortCode={order.short_code}
            actions={actions}
            pending={pending}
            onSelect={run}
          />
        </div>
      </header>

      <div className="space-y-1.5 text-sm">
        <p className="text-muted-foreground flex items-center gap-1.5 text-xs">
          <UserRoundIcon aria-hidden="true" className="size-3.5" />
          <span className="truncate">{order.customer_name ?? 'Cliente'}</span>
        </p>
        <p className="line-clamp-2">{itemsSummary(order.items)}</p>
        {order.notes ? (
          <p className="text-muted-foreground flex items-start gap-1.5 text-xs">
            <StickyNoteIcon
              aria-hidden="true"
              className="mt-0.5 size-3.5 shrink-0"
            />
            <span className="line-clamp-2">{order.notes}</span>
          </p>
        ) : null}
        <p className="font-semibold tabular-nums">{formatCOP(order.total)}</p>
      </div>

      <OrderActions actions={actions} pending={pending} onAction={run} />

      <AlertDialog
        open={confirming !== null}
        onOpenChange={(open) => {
          if (!open) setConfirming(null)
        }}
      >
        <AlertDialogContent className="rounded-card">
          <AlertDialogHeader>
            <AlertDialogTitle className="font-display text-xl">
              {order.status === 'pending' ? 'Rechazar' : 'Cancelar'} el pedido #
              {order.short_code}
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
                if (confirming) onTransition(order.id, confirming.to)
                setConfirming(null)
              }}
            >
              Sí, {order.status === 'pending' ? 'rechazar' : 'cancelar'}
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </article>
  )
}
