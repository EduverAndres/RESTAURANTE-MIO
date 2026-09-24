// Spanish copy and payload building for web push notifications. Pure: no
// env access, no network. Each function returns the full payload `send.ts`
// hands to `webpush.sendNotification` as-is.
import type { OrderStatus } from '@/types/app'

export interface PushPayload {
  title: string
  body: string
  url: string
  tag: string
}

function orderUrl(orderId: string): string {
  return `/orders/${orderId}`
}

function orderTag(orderId: string): string {
  return `order-${orderId}`
}

const STATUS_MESSAGES: Partial<
  Record<OrderStatus, (shortCode: string) => { title: string; body: string }>
> = {
  accepted: (shortCode) => ({
    title: 'Pedido aceptado',
    body: `Tu pedido #${shortCode} fue aceptado y ya se está preparando.`,
  }),
  preparing: (shortCode) => ({
    title: 'Preparando tu pedido',
    body: `Tu pedido #${shortCode} se está preparando.`,
  }),
  ready: (shortCode) => ({
    title: 'Pedido listo',
    body: `Tu pedido #${shortCode} está listo.`,
  }),
  picked_up: (shortCode) => ({
    title: 'Pedido en camino',
    body: `Tu pedido #${shortCode} va en camino.`,
  }),
  delivered: (shortCode) => ({
    title: 'Pedido entregado',
    body: `Tu pedido #${shortCode} fue entregado. ¡Buen provecho!`,
  }),
  cancelled: (shortCode) => ({
    title: 'Pedido cancelado',
    body: `Tu pedido #${shortCode} fue cancelado.`,
  }),
}

/**
 * Customer-facing push for an order status change, or null when the status
 * has no push (order creation/`pending` is announced to the merchant, not
 * echoed back to the customer). Tagged by order so a later status replaces
 * the previous notification instead of stacking.
 */
export function orderStatusMessage(
  status: OrderStatus,
  shortCode: string,
  orderId: string,
): PushPayload | null {
  const builder = STATUS_MESSAGES[status]
  if (!builder) return null
  return { ...builder(shortCode), url: orderUrl(orderId), tag: orderTag(orderId) }
}

/** Merchant-facing push for a freshly placed order, linking to the dashboard. */
export function newOrderMessage(
  shortCode: string,
  storeName: string,
): PushPayload {
  return {
    title: `Nuevo pedido #${shortCode}`,
    body: `${storeName} recibió un nuevo pedido. Revisa el panel para confirmarlo.`,
    url: '/dashboard',
    tag: 'new-order',
  }
}

/** Customer-facing push once a courier claims their delivery. */
export function courierAssignedMessage(
  shortCode: string,
  orderId: string,
): PushPayload {
  return {
    title: 'Domiciliario asignado',
    body: `Un domiciliario va en camino con tu pedido #${shortCode}.`,
    url: orderUrl(orderId),
    tag: orderTag(orderId),
  }
}

/**
 * Customer-facing push once the courier picks up a delivery: the handover
 * code is waiting on the order page. The code itself is never put in the
 * body — a notification sits on the lock screen for anyone to read — and
 * the tag is distinct so this does not replace the "en camino" one.
 */
export function deliveryCodeMessage(orderId: string): PushPayload {
  return {
    title: 'Tu código de entrega',
    body: 'Muéstralo al domiciliario cuando llegue.',
    url: orderUrl(orderId),
    tag: `${orderTag(orderId)}-code`,
  }
}
