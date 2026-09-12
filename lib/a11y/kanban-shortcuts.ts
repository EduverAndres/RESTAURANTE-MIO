// Keyboard shortcuts for the merchant Kanban.
//
// Pure module: the board wires these to a card's own `onKeyDown`, never to
// `document`, so a merchant typing a note or a search term can never trigger
// a status change by accident. `isTypingTarget` is the second guard, for the
// case where a text control is nested inside a focusable card.

import type { MerchantAction } from '@/lib/orders/status'
import type { OrderStatus } from '@/types/app'

/** Letter keys the board listens to, mapped to the transition they mean. */
export const KANBAN_SHORTCUTS: Readonly<Record<string, OrderStatus>> = {
  a: 'accepted',
  l: 'ready',
}

export const KANBAN_SHORTCUT_HINT =
  'Con una tarjeta enfocada: A para aceptar, L para marcar listo.'

/**
 * The action a key stands for, or `null`.
 *
 * Resolution goes through the transitions the order actually allows right
 * now, so a shortcut can never perform a move the buttons would not offer —
 * including the destructive ones, which have no shortcut at all.
 */
export function shortcutAction(
  key: string,
  actions: readonly MerchantAction[],
): MerchantAction | null {
  const target = KANBAN_SHORTCUTS[key.toLowerCase()]
  if (!target) return null
  return actions.find((action) => action.to === target) ?? null
}

const TEXT_INPUT_TYPES = new Set([
  'text',
  'search',
  'email',
  'url',
  'tel',
  'password',
  'number',
  'date',
  'datetime-local',
  'month',
  'time',
  'week',
])

/** True when a keystroke belongs to whatever the user is typing into. */
export function isTypingTarget(target: EventTarget | null): boolean {
  if (!(target instanceof Element)) return false
  const tag = target.tagName.toLowerCase()
  if (tag === 'textarea' || tag === 'select') return true
  if (tag === 'input') {
    const type = (target.getAttribute('type') ?? 'text').toLowerCase()
    return TEXT_INPUT_TYPES.has(type)
  }
  if (target.getAttribute('role') === 'textbox') return true
  return target.closest('[contenteditable="true"],[contenteditable=""]') !== null
}
