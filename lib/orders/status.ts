// Spanish labels and visual tones for domain enums. Pure module: safe to
// import from client components, server components and tests.
import type {
  OrderStatus,
  OrderType,
  PaymentStatus,
  StoreStatus,
  UserRole,
} from '@/types/app'

export type StatusTone =
  'neutral' | 'info' | 'warning' | 'primary' | 'success' | 'destructive'

export const ORDER_STATUS_LABELS: Record<OrderStatus, string> = {
  pending: 'Nuevo',
  accepted: 'Aceptado',
  preparing: 'En preparación',
  ready: 'Listo',
  picked_up: 'En camino',
  delivered: 'Entregado',
  cancelled: 'Cancelado',
}

export const ORDER_STATUS_TONES: Record<OrderStatus, StatusTone> = {
  pending: 'warning',
  accepted: 'info',
  preparing: 'info',
  ready: 'primary',
  picked_up: 'primary',
  delivered: 'success',
  cancelled: 'destructive',
}

export const ORDER_STATUS_SEQUENCE: readonly OrderStatus[] = [
  'pending',
  'accepted',
  'preparing',
  'ready',
  'picked_up',
  'delivered',
]

export const STORE_STATUS_LABELS: Record<StoreStatus, string> = {
  pending: 'En revisión',
  active: 'Activa',
  suspended: 'Suspendida',
}

export const STORE_STATUS_TONES: Record<StoreStatus, StatusTone> = {
  pending: 'warning',
  active: 'success',
  suspended: 'destructive',
}

export const PAYMENT_STATUS_LABELS: Record<PaymentStatus, string> = {
  pending: 'Pago pendiente',
  paid: 'Pago aprobado',
  failed: 'Pago rechazado',
  refunded: 'Reembolsado',
}

export const PAYMENT_STATUS_TONES: Record<PaymentStatus, StatusTone> = {
  pending: 'warning',
  paid: 'success',
  failed: 'destructive',
  refunded: 'neutral',
}

function isPaymentStatus(value: string): value is PaymentStatus {
  return value in PAYMENT_STATUS_LABELS
}

/** Label for a payment status coming from the database. */
export function paymentStatusLabel(status: string): string {
  return isPaymentStatus(status) ? PAYMENT_STATUS_LABELS[status] : status
}

export function paymentStatusTone(status: string): StatusTone {
  return isPaymentStatus(status) ? PAYMENT_STATUS_TONES[status] : 'neutral'
}

export const ORDER_TYPE_LABELS: Record<OrderType, string> = {
  delivery: 'Domicilio',
  pickup: 'Para recoger',
  table: 'En mesa',
}

export const ROLE_LABELS: Record<UserRole, string> = {
  customer: 'Cliente',
  merchant: 'Restaurante',
  courier: 'Domiciliario',
  admin: 'Administrador',
}

function isOrderStatus(value: string): value is OrderStatus {
  return value in ORDER_STATUS_LABELS
}

/** Label for a status coming from the database; unknown values pass through. */
export function orderStatusLabel(status: string): string {
  return isOrderStatus(status) ? ORDER_STATUS_LABELS[status] : status
}

export function orderStatusTone(status: string): StatusTone {
  return isOrderStatus(status) ? ORDER_STATUS_TONES[status] : 'neutral'
}

// ---------------------------------------------------------------------------
// Merchant transitions
// ---------------------------------------------------------------------------
// The database has no transition machine, so the app enforces which moves a
// merchant may perform. `ready` branches by order type: deliveries go out
// with a courier (picked_up) while pickup/table orders are handed over
// directly (delivered).

export const MERCHANT_TRANSITIONS: Record<OrderStatus, readonly OrderStatus[]> =
  {
    pending: ['accepted', 'cancelled'],
    accepted: ['preparing', 'cancelled'],
    preparing: ['ready'],
    ready: ['picked_up', 'delivered'],
    picked_up: ['delivered'],
    delivered: [],
    cancelled: [],
  }

function allowedFromReady(orderType: OrderType): readonly OrderStatus[] {
  return orderType === 'delivery' ? ['picked_up'] : ['delivered']
}

/** Targets a merchant may move an order to, given its type. */
export function merchantTargets(
  from: OrderStatus,
  orderType: OrderType,
): readonly OrderStatus[] {
  if (from === 'ready') return allowedFromReady(orderType)
  return MERCHANT_TRANSITIONS[from]
}

export function canMerchantTransition(
  from: OrderStatus,
  to: OrderStatus,
  orderType: OrderType,
): boolean {
  return merchantTargets(from, orderType).includes(to)
}

export interface MerchantAction {
  to: OrderStatus
  label: string
  tone: StatusTone
}

const ACTION_LABELS: Partial<Record<`${OrderStatus}>${OrderStatus}`, string>> =
  {
    'pending>accepted': 'Aceptar',
    'pending>cancelled': 'Rechazar',
    'accepted>preparing': 'Empezar a preparar',
    'accepted>cancelled': 'Cancelar',
    'preparing>ready': 'Marcar listo',
    'ready>picked_up': 'Salió a domicilio',
    'ready>delivered': 'Entregado',
    'picked_up>delivered': 'Entregado',
  }

function actionTone(to: OrderStatus): StatusTone {
  if (to === 'cancelled') return 'destructive'
  if (to === 'delivered') return 'success'
  return 'primary'
}

/** Ordered actions for the order card; cancel/reject always comes last. */
export function nextMerchantActions(
  status: OrderStatus,
  orderType: OrderType,
): MerchantAction[] {
  return merchantTargets(status, orderType).map((to) => ({
    to,
    label: ACTION_LABELS[`${status}>${to}`] ?? ORDER_STATUS_LABELS[to],
    tone: actionTone(to),
  }))
}

// ---------------------------------------------------------------------------
// Courier transitions
// ---------------------------------------------------------------------------
// RLS lets a courier update any order assigned to them without restricting
// the status, so the app enforces the two legal moves. Claiming an order is
// not a status change (it only sets courier_id) and lives in the action.

export const COURIER_TRANSITIONS: Partial<
  Record<OrderStatus, readonly OrderStatus[]>
> = {
  ready: ['picked_up'],
  picked_up: ['delivered'],
}

export function canCourierTransition(
  from: OrderStatus,
  to: OrderStatus,
): boolean {
  return (COURIER_TRANSITIONS[from] ?? []).includes(to)
}

export interface CourierAction {
  to: OrderStatus
  label: string
  tone: StatusTone
}

const COURIER_ACTION_LABELS: Partial<Record<OrderStatus, string>> = {
  picked_up: 'Recogí el pedido',
  delivered: 'Entregado',
}

/** Single next step for the courier, or null when there is nothing to do. */
export function nextCourierAction(status: OrderStatus): CourierAction | null {
  const to = COURIER_TRANSITIONS[status]?.[0]
  if (!to) return null
  return {
    to,
    label: COURIER_ACTION_LABELS[to] ?? ORDER_STATUS_LABELS[to],
    tone: actionTone(to),
  }
}
