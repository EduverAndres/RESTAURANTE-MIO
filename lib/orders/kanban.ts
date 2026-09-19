// Pure helpers behind the merchant Kanban. No React, no Supabase.
import type {
  OrderStatus,
  OrderType,
  PaymentMethod,
  PaymentStatus,
} from '@/types/app'

export { startOfLocalDay } from '@/lib/dates'

export type ActiveOrderStatus =
  'pending' | 'accepted' | 'preparing' | 'ready' | 'picked_up'

export interface BoardOrderItem {
  name: string
  quantity: number
}

/** Flat order shape used by the board; built by the page from the query. */
export interface BoardOrder {
  id: string
  short_code: string
  status: OrderStatus
  type: OrderType
  table_number: number | null
  total: number
  payment_status: PaymentStatus
  payment_method: PaymentMethod
  notes: string | null
  created_at: string
  customer_name: string | null
  items: BoardOrderItem[]
}

export interface KanbanColumn {
  status: ActiveOrderStatus
  title: string
}

export const KANBAN_COLUMNS: readonly KanbanColumn[] = [
  { status: 'pending', title: 'Nuevos' },
  { status: 'accepted', title: 'Aceptados' },
  { status: 'preparing', title: 'En preparación' },
  { status: 'ready', title: 'Listos' },
  { status: 'picked_up', title: 'En camino' },
]

export const TERMINAL_STATUSES: readonly OrderStatus[] = [
  'delivered',
  'cancelled',
]

export function isActiveStatus(
  status: OrderStatus,
): status is ActiveOrderStatus {
  return !TERMINAL_STATUSES.includes(status)
}

export interface Board {
  columns: Record<ActiveOrderStatus, BoardOrder[]>
  history: BoardOrder[]
}

function byCreatedAsc(a: BoardOrder, b: BoardOrder): number {
  return a.created_at.localeCompare(b.created_at)
}

/** Active orders go to their column (oldest first); terminal ones to history. */
export function groupOrdersForBoard(orders: readonly BoardOrder[]): Board {
  const columns: Board['columns'] = {
    pending: [],
    accepted: [],
    preparing: [],
    ready: [],
    picked_up: [],
  }
  const history: BoardOrder[] = []
  for (const order of orders) {
    if (isActiveStatus(order.status)) columns[order.status].push(order)
    else history.push(order)
  }
  for (const status of Object.keys(columns) as ActiveOrderStatus[]) {
    columns[status].sort(byCreatedAsc)
  }
  history.sort((a, b) => byCreatedAsc(b, a))
  return { columns, history }
}

/** "ahora", "hace 10 min", "hace 1 h 30 min", "hace 4 h". */
export function elapsedLabel(isoDate: string, now: Date): string {
  const minutes = Math.max(
    0,
    Math.floor((now.getTime() - new Date(isoDate).getTime()) / 60_000),
  )
  if (minutes < 1) return 'ahora'
  if (minutes < 60) return `hace ${minutes} min`
  const hours = Math.floor(minutes / 60)
  const rest = minutes % 60
  return rest === 0 ? `hace ${hours} h` : `hace ${hours} h ${rest} min`
}

const SUMMARY_LIMIT = 3

export function itemsSummary(items: readonly BoardOrderItem[]): string {
  if (items.length === 0) return 'Sin productos'
  const shown = items
    .slice(0, SUMMARY_LIMIT)
    .map((item) => `${item.quantity}× ${item.name}`)
    .join(', ')
  const rest = items.length - SUMMARY_LIMIT
  return rest > 0 ? `${shown} +${rest} más` : shown
}
