'use client'

import { EllipsisVerticalIcon } from 'lucide-react'
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuLabel,
  DropdownMenuSeparator,
  DropdownMenuShortcut,
  DropdownMenuTrigger,
} from '@/components/ui/dropdown-menu'
import { Button } from '@/components/ui/button'
import { KANBAN_SHORTCUTS } from '@/lib/a11y/kanban-shortcuts'
import { ORDER_STATUS_LABELS, type MerchantAction } from '@/lib/orders/status'
import type { OrderStatus } from '@/types/app'

interface OrderCardMenuProps {
  shortCode: string
  actions: readonly MerchantAction[]
  pending: boolean
  onSelect: (action: MerchantAction) => void
}

/** The letter that triggers this move, when it has one. */
function shortcutFor(to: OrderStatus): string | null {
  const entry = Object.entries(KANBAN_SHORTCUTS).find(
    ([, target]) => target === to,
  )
  return entry ? entry[0].toUpperCase() : null
}

/**
 * Every legal move for one order, in a menu.
 *
 * The card already shows the same moves as buttons; this exists so the whole
 * board is operable the same way from the keyboard — one Tab per card, then
 * a menu that names where the order can go, instead of hunting through a row
 * of buttons whose labels only make sense next to the card they belong to.
 * The options come from `lib/orders/status.ts`, so the menu can never offer a
 * transition the server would refuse.
 */
export function OrderCardMenu({
  shortCode,
  actions,
  pending,
  onSelect,
}: OrderCardMenuProps) {
  if (actions.length === 0) return null

  return (
    <DropdownMenu>
      <DropdownMenuTrigger asChild>
        <Button
          type="button"
          variant="ghost"
          size="icon-sm"
          disabled={pending}
          aria-label={`Acciones del pedido ${shortCode}`}
          className="rounded-pill shrink-0"
        >
          <EllipsisVerticalIcon aria-hidden="true" />
        </Button>
      </DropdownMenuTrigger>
      <DropdownMenuContent align="end" className="w-56">
        <DropdownMenuLabel>Mover el pedido {shortCode}</DropdownMenuLabel>
        <DropdownMenuSeparator />
        {actions.map((action) => {
          const key = shortcutFor(action.to)
          return (
            <DropdownMenuItem
              key={action.to}
              variant={
                action.tone === 'destructive' ? 'destructive' : 'default'
              }
              onSelect={() => onSelect(action)}
            >
              {action.label}
              <span className="sr-only">
                {' '}
                — pasa a {ORDER_STATUS_LABELS[action.to]}
              </span>
              {key ? (
                <DropdownMenuShortcut aria-hidden="true">
                  {key}
                </DropdownMenuShortcut>
              ) : null}
            </DropdownMenuItem>
          )
        })}
      </DropdownMenuContent>
    </DropdownMenu>
  )
}
