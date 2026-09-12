// Pure price arithmetic shared by the cart (client), the checkout action
// (server) and tests. Amounts are integer Colombian pesos.
import type { OrderItemOption, OrderType } from '@/types/app'

export interface PriceableItem {
  unitPrice: number
  quantity: number
  options: OrderItemOption[]
}

export type TipChoice =
  { kind: 'percent'; value: number } | { kind: 'fixed'; value: number }

export const TIP_PRESETS = [0, 5, 10, 15] as const

export function optionsDelta(options: OrderItemOption[]): number {
  return options.reduce((sum, option) => sum + option.price_delta, 0)
}

export function computeLineTotal(item: PriceableItem): number {
  const unit = item.unitPrice + optionsDelta(item.options)
  return Math.max(0, Math.round(unit * item.quantity))
}

/** Percentage tips are rounded to the nearest 100 pesos to keep totals tidy. */
export function computeTip(subtotal: number, choice: TipChoice): number {
  if (choice.kind === 'fixed') return Math.max(0, Math.round(choice.value))
  const raw = (subtotal * Math.max(0, choice.value)) / 100
  return Math.round(raw / 100) * 100
}

export interface OrderTotalsInput {
  items: PriceableItem[]
  type: OrderType
  deliveryFee: number
  tip: number
}

export interface OrderTotals {
  subtotal: number
  deliveryFee: number
  tip: number
  total: number
}

export function computeOrderTotals(input: OrderTotalsInput): OrderTotals {
  const subtotal = input.items.reduce(
    (sum, item) => sum + computeLineTotal(item),
    0,
  )
  if (subtotal === 0) return { subtotal: 0, deliveryFee: 0, tip: 0, total: 0 }

  const deliveryFee =
    input.type === 'delivery' ? Math.max(0, Math.round(input.deliveryFee)) : 0
  const tip = Math.max(0, Math.round(input.tip))
  return { subtotal, deliveryFee, tip, total: subtotal + deliveryFee + tip }
}

export function meetsMinOrder(
  subtotal: number,
  minOrder: number | null | undefined,
): boolean {
  return subtotal >= (minOrder ?? 0)
}
