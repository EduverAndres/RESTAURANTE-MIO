import { describe, expect, it } from 'vitest'
import {
  courierAssignedMessage,
  deliveryCodeMessage,
  newOrderMessage,
  orderStatusMessage,
} from '@/lib/push/messages'

const ORDER_ID = '11111111-1111-4111-8111-111111111111'

describe('orderStatusMessage', () => {
  it('returns Spanish copy for each customer-facing status, tagged and linked to the order', () => {
    expect(orderStatusMessage('accepted', 'A1B2', ORDER_ID)).toEqual({
      title: 'Pedido aceptado',
      body: 'Tu pedido #A1B2 fue aceptado y ya se está preparando.',
      url: `/orders/${ORDER_ID}`,
      tag: `order-${ORDER_ID}`,
    })
    expect(orderStatusMessage('preparing', 'A1B2', ORDER_ID)).toMatchObject({
      title: 'Preparando tu pedido',
      body: 'Tu pedido #A1B2 se está preparando.',
    })
    expect(orderStatusMessage('ready', 'A1B2', ORDER_ID)).toMatchObject({
      title: 'Pedido listo',
      body: 'Tu pedido #A1B2 está listo.',
    })
    expect(orderStatusMessage('picked_up', 'A1B2', ORDER_ID)).toMatchObject({
      title: 'Pedido en camino',
      body: 'Tu pedido #A1B2 va en camino.',
    })
    expect(orderStatusMessage('delivered', 'A1B2', ORDER_ID)).toMatchObject({
      title: 'Pedido entregado',
      body: 'Tu pedido #A1B2 fue entregado. ¡Buen provecho!',
    })
    expect(orderStatusMessage('cancelled', 'A1B2', ORDER_ID)).toMatchObject({
      title: 'Pedido cancelado',
      body: 'Tu pedido #A1B2 fue cancelado.',
    })
  })

  it('returns null for pending: order creation has no status-change push', () => {
    expect(orderStatusMessage('pending', 'A1B2', ORDER_ID)).toBeNull()
  })
})

describe('newOrderMessage', () => {
  it('builds the merchant copy pointing at the dashboard', () => {
    expect(newOrderMessage('A1B2', 'La Parrilla')).toEqual({
      title: 'Nuevo pedido #A1B2',
      body: 'La Parrilla recibió un nuevo pedido. Revisa el panel para confirmarlo.',
      url: '/dashboard',
      tag: 'new-order',
    })
  })
})

describe('courierAssignedMessage', () => {
  it('builds the customer copy announcing the assigned courier, linked to the order', () => {
    expect(courierAssignedMessage('A1B2', ORDER_ID)).toEqual({
      title: 'Domiciliario asignado',
      body: 'Un domiciliario va en camino con tu pedido #A1B2.',
      url: `/orders/${ORDER_ID}`,
      tag: `order-${ORDER_ID}`,
    })
  })
})

describe('deliveryCodeMessage', () => {
  it('tells the customer a code is waiting on the order page without leaking it', () => {
    const message = deliveryCodeMessage(ORDER_ID)
    expect(message).toEqual({
      title: 'Tu código de entrega',
      body: 'Muéstralo al domiciliario cuando llegue.',
      url: `/orders/${ORDER_ID}`,
      tag: `order-${ORDER_ID}-code`,
    })
    // The builder never even receives the code, so the visible text cannot
    // carry it; pin that so a future "helpful" body does not put it back.
    expect(`${message.title} ${message.body}`).not.toMatch(/\d/)
  })

  it('uses its own tag so it does not replace the "en camino" notification', () => {
    expect(deliveryCodeMessage(ORDER_ID).tag).not.toBe(
      orderStatusMessage('picked_up', 'A1B2', ORDER_ID)?.tag,
    )
  })
})
