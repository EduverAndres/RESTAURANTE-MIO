import { describe, expect, it } from 'vitest'
import {
  ORDER_STATUS_LABELS,
  ORDER_STATUS_TONES,
  ORDER_TYPE_LABELS,
  PAYMENT_STATUS_LABELS,
  ROLE_LABELS,
  STORE_STATUS_LABELS,
  orderStatusLabel,
  paymentStatusLabel,
  paymentStatusTone,
} from '@/lib/orders/status'

describe('order status labels', () => {
  it('covers every order status with Spanish copy', () => {
    expect(ORDER_STATUS_LABELS).toEqual({
      pending: 'Nuevo',
      accepted: 'Aceptado',
      preparing: 'En preparación',
      ready: 'Listo',
      picked_up: 'En camino',
      delivered: 'Entregado',
      cancelled: 'Cancelado',
    })
  })

  it('assigns a visual tone to every status', () => {
    for (const status of Object.keys(ORDER_STATUS_LABELS)) {
      expect(ORDER_STATUS_TONES).toHaveProperty(status)
    }
    expect(ORDER_STATUS_TONES.delivered).toBe('success')
    expect(ORDER_STATUS_TONES.cancelled).toBe('destructive')
  })

  it('falls back to the raw value for unknown statuses', () => {
    expect(orderStatusLabel('pending')).toBe('Nuevo')
    expect(orderStatusLabel('weird')).toBe('weird')
  })

  it('labels store statuses, order types and roles', () => {
    expect(STORE_STATUS_LABELS.pending).toBe('En revisión')
    expect(STORE_STATUS_LABELS.active).toBe('Activa')
    expect(STORE_STATUS_LABELS.suspended).toBe('Suspendida')
    expect(ORDER_TYPE_LABELS.delivery).toBe('Domicilio')
    expect(ORDER_TYPE_LABELS.pickup).toBe('Para recoger')
    expect(ORDER_TYPE_LABELS.table).toBe('En mesa')
    expect(ROLE_LABELS.customer).toBe('Cliente')
    expect(ROLE_LABELS.merchant).toBe('Restaurante')
    expect(ROLE_LABELS.courier).toBe('Domiciliario')
    expect(ROLE_LABELS.admin).toBe('Administrador')
  })
})

describe('payment status labels', () => {
  it('covers every payment status with Spanish copy', () => {
    expect(PAYMENT_STATUS_LABELS).toEqual({
      pending: 'Pago pendiente',
      paid: 'Pago aprobado',
      failed: 'Pago rechazado',
      refunded: 'Reembolsado',
    })
  })

  it('assigns success/destructive tones and falls back for unknown values', () => {
    expect(paymentStatusLabel('paid')).toBe('Pago aprobado')
    expect(paymentStatusTone('paid')).toBe('success')
    expect(paymentStatusTone('failed')).toBe('destructive')
    expect(paymentStatusTone('weird')).toBe('neutral')
    expect(paymentStatusLabel('weird')).toBe('weird')
  })
})

describe('merchant transitions', () => {
  it('exposes the transition map with terminal states empty', async () => {
    const { MERCHANT_TRANSITIONS } = await import('@/lib/orders/status')
    expect(MERCHANT_TRANSITIONS.pending).toEqual(['accepted', 'cancelled'])
    expect(MERCHANT_TRANSITIONS.accepted).toEqual(['preparing', 'cancelled'])
    expect(MERCHANT_TRANSITIONS.preparing).toEqual(['ready'])
    expect(MERCHANT_TRANSITIONS.ready).toEqual(['picked_up', 'delivered'])
    expect(MERCHANT_TRANSITIONS.picked_up).toEqual(['delivered'])
    expect(MERCHANT_TRANSITIONS.delivered).toEqual([])
    expect(MERCHANT_TRANSITIONS.cancelled).toEqual([])
  })

  it('allows the happy path and rejects skips and terminal moves', async () => {
    const { canMerchantTransition } = await import('@/lib/orders/status')
    expect(canMerchantTransition('pending', 'accepted', 'delivery')).toBe(true)
    expect(canMerchantTransition('pending', 'cancelled', 'pickup')).toBe(true)
    expect(canMerchantTransition('accepted', 'preparing', 'table')).toBe(true)
    expect(canMerchantTransition('preparing', 'ready', 'delivery')).toBe(true)
    expect(canMerchantTransition('pending', 'preparing', 'delivery')).toBe(
      false,
    )
    expect(canMerchantTransition('preparing', 'cancelled', 'delivery')).toBe(
      false,
    )
    expect(canMerchantTransition('delivered', 'pending', 'delivery')).toBe(
      false,
    )
    expect(canMerchantTransition('cancelled', 'accepted', 'pickup')).toBe(false)
    expect(canMerchantTransition('ready', 'ready', 'pickup')).toBe(false)
  })

  it('branches ready by order type', async () => {
    const { canMerchantTransition } = await import('@/lib/orders/status')
    expect(canMerchantTransition('ready', 'picked_up', 'delivery')).toBe(true)
    expect(canMerchantTransition('ready', 'delivered', 'delivery')).toBe(false)
    expect(canMerchantTransition('ready', 'delivered', 'pickup')).toBe(true)
    expect(canMerchantTransition('ready', 'picked_up', 'pickup')).toBe(false)
    expect(canMerchantTransition('ready', 'delivered', 'table')).toBe(true)
    expect(canMerchantTransition('ready', 'picked_up', 'table')).toBe(false)
    expect(canMerchantTransition('picked_up', 'delivered', 'delivery')).toBe(
      true,
    )
  })

  it('returns ordered actions with Spanish labels, cancel last', async () => {
    const { nextMerchantActions } = await import('@/lib/orders/status')
    expect(nextMerchantActions('pending', 'delivery')).toEqual([
      { to: 'accepted', label: 'Aceptar', tone: 'primary' },
      { to: 'cancelled', label: 'Rechazar', tone: 'destructive' },
    ])
    expect(nextMerchantActions('accepted', 'pickup')).toEqual([
      { to: 'preparing', label: 'Empezar a preparar', tone: 'primary' },
      { to: 'cancelled', label: 'Cancelar', tone: 'destructive' },
    ])
    expect(nextMerchantActions('preparing', 'table')).toEqual([
      { to: 'ready', label: 'Marcar listo', tone: 'primary' },
    ])
    expect(nextMerchantActions('ready', 'delivery')).toEqual([
      { to: 'picked_up', label: 'Salió a domicilio', tone: 'primary' },
    ])
    expect(nextMerchantActions('ready', 'pickup')).toEqual([
      { to: 'delivered', label: 'Entregado', tone: 'success' },
    ])
    expect(nextMerchantActions('picked_up', 'delivery')).toEqual([
      { to: 'delivered', label: 'Entregado', tone: 'success' },
    ])
    expect(nextMerchantActions('delivered', 'delivery')).toEqual([])
    expect(nextMerchantActions('cancelled', 'delivery')).toEqual([])
  })
})

describe('courier transitions', () => {
  it('exposes only the two courier moves', async () => {
    const { COURIER_TRANSITIONS } = await import('@/lib/orders/status')
    expect(COURIER_TRANSITIONS).toEqual({
      ready: ['picked_up'],
      picked_up: ['delivered'],
    })
  })

  it('allows ready→picked_up and picked_up→delivered only', async () => {
    const { canCourierTransition } = await import('@/lib/orders/status')
    expect(canCourierTransition('ready', 'picked_up')).toBe(true)
    expect(canCourierTransition('picked_up', 'delivered')).toBe(true)
    expect(canCourierTransition('ready', 'delivered')).toBe(false)
    expect(canCourierTransition('pending', 'accepted')).toBe(false)
    expect(canCourierTransition('preparing', 'ready')).toBe(false)
    expect(canCourierTransition('picked_up', 'cancelled')).toBe(false)
    expect(canCourierTransition('delivered', 'picked_up')).toBe(false)
    expect(canCourierTransition('cancelled', 'picked_up')).toBe(false)
  })

  it('returns the next courier action with Spanish label, or null', async () => {
    const { nextCourierAction } = await import('@/lib/orders/status')
    expect(nextCourierAction('ready')).toEqual({
      to: 'picked_up',
      label: 'Recogí el pedido',
      tone: 'primary',
    })
    expect(nextCourierAction('picked_up')).toEqual({
      to: 'delivered',
      label: 'Entregado',
      tone: 'success',
    })
    expect(nextCourierAction('pending')).toBeNull()
    expect(nextCourierAction('preparing')).toBeNull()
    expect(nextCourierAction('delivered')).toBeNull()
    expect(nextCourierAction('cancelled')).toBeNull()
  })
})
