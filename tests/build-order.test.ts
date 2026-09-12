import type { SupabaseClient } from '@supabase/supabase-js'
import { afterEach, describe, expect, it, vi } from 'vitest'
import {
  buildOrderTotals,
  orderItemRows,
  priceCartItems,
  recordPaymentResult,
  type CatalogueProduct,
  type PricedItem,
} from '@/lib/orders/build-order'
import { computeTip } from '@/lib/pricing'
import type { Database } from '@/types/database'

const STORE = 'store-1'

const burger: CatalogueProduct = {
  id: 'p1',
  name: 'Hamburguesa',
  price: 18900,
  is_available: true,
  store_id: STORE,
  product_options: [
    {
      id: 'o1',
      name: 'Término',
      required: true,
      min: 1,
      max: 1,
      product_option_values: [
        { id: 'v1', name: 'Medio', price_delta: 0 },
        { id: 'v2', name: 'Bien cocido', price_delta: 0 },
      ],
    },
    {
      id: 'o2',
      name: 'Extras',
      required: false,
      min: 0,
      max: 2,
      product_option_values: [
        { id: 'v3', name: 'Queso', price_delta: '2000' },
        { id: 'v4', name: 'Tocineta', price_delta: 3000 },
      ],
    },
  ],
}

const soda: CatalogueProduct = {
  id: 'p2',
  name: 'Gaseosa',
  price: '5000',
  is_available: true,
  store_id: STORE,
  product_options: [],
}

const catalogue = [burger, soda]

describe('priceCartItems', () => {
  it('re-prices lines from the catalogue with the chosen options', () => {
    const result = priceCartItems(
      [
        { productId: 'p1', quantity: 2, optionValueIds: ['v1', 'v3'], notes: '' },
        { productId: 'p2', quantity: 1, optionValueIds: [], notes: 'fría' },
      ],
      catalogue,
      STORE,
    )
    expect(result.ok).toBe(true)
    if (!result.ok) return
    expect(result.items).toHaveLength(2)
    expect(result.items[0]).toMatchObject({
      product_id: 'p1',
      name_snapshot: 'Hamburguesa',
      unit_price: 18900,
      quantity: 2,
      notes: '',
    })
    expect(result.items[0].options).toEqual([
      { option: 'Término', value: 'Medio', price_delta: 0 },
      { option: 'Extras', value: 'Queso', price_delta: 2000 },
    ])
    expect(result.items[1]).toMatchObject({
      unit_price: 5000,
      notes: 'fría',
      options: [],
    })
  })

  it('fails when a product is missing, unavailable or from another store', () => {
    const missing = priceCartItems(
      [{ productId: 'nope', quantity: 1, optionValueIds: [], notes: '' }],
      catalogue,
      STORE,
    )
    expect(missing).toEqual({
      ok: false,
      error: 'Uno de los productos ya no está disponible. Revisa tu carrito.',
    })

    const unavailable = priceCartItems(
      [{ productId: 'p2', quantity: 1, optionValueIds: [], notes: '' }],
      [{ ...soda, is_available: false }],
      STORE,
    )
    expect(unavailable.ok).toBe(false)

    const foreign = priceCartItems(
      [{ productId: 'p2', quantity: 1, optionValueIds: [], notes: '' }],
      [{ ...soda, store_id: 'other' }],
      STORE,
    )
    expect(foreign.ok).toBe(false)
  })

  it('enforces required options and the maximum per group', () => {
    const missingRequired = priceCartItems(
      [{ productId: 'p1', quantity: 1, optionValueIds: [], notes: '' }],
      catalogue,
      STORE,
    )
    expect(missingRequired).toEqual({
      ok: false,
      error: 'Revisa las opciones de Hamburguesa.',
    })

    const tooMany = priceCartItems(
      [
        {
          productId: 'p1',
          quantity: 1,
          optionValueIds: ['v1', 'v2'],
          notes: '',
        },
      ],
      catalogue,
      STORE,
    )
    expect(tooMany.ok).toBe(false)
  })
})

describe('orderItemRows', () => {
  const priced: PricedItem[] = [
    {
      product_id: 'p2',
      name_snapshot: 'Gaseosa',
      unit_price: 5000,
      quantity: 1,
      options: [],
      notes: 'fría',
    },
    {
      product_id: 'p1',
      name_snapshot: 'Hamburguesa',
      unit_price: 18900,
      quantity: 2,
      options: [{ option: 'Extras', value: 'Queso', price_delta: 2000 }],
      notes: '',
    },
  ]

  it('appends the notes to the name snapshot and keeps the options json', () => {
    const rows = orderItemRows('order-1', priced)
    expect(rows[0]).toMatchObject({
      order_id: 'order-1',
      product_id: 'p2',
      name_snapshot: 'Gaseosa · fría',
      unit_price: 5000,
      quantity: 1,
    })
    expect(rows[1].name_snapshot).toBe('Hamburguesa')
    expect(rows[1].options).toEqual([
      { option: 'Extras', value: 'Queso', price_delta: 2000 },
    ])
  })
})

describe('buildOrderTotals', () => {
  const items: PricedItem[] = [
    {
      product_id: 'p1',
      name_snapshot: 'Hamburguesa',
      unit_price: 18900,
      quantity: 2,
      options: [{ option: 'Extras', value: 'Queso', price_delta: 2000 }],
      notes: '',
    },
  ]

  it('charges the delivery fee and tip only where they apply', () => {
    const delivery = buildOrderTotals({
      items,
      type: 'delivery',
      deliveryFee: 4000,
      minOrder: 0,
      storeName: 'La Parrilla',
      tipPercent: 10,
    })
    expect(delivery.ok).toBe(true)
    if (!delivery.ok) return
    const expectedTip = computeTip(41800, { kind: 'percent', value: 10 })
    expect(delivery.totals.subtotal).toBe(41800)
    expect(delivery.totals.deliveryFee).toBe(4000)
    expect(delivery.totals.tip).toBe(expectedTip)
    expect(expectedTip).toBeGreaterThan(0)
    expect(delivery.totals.total).toBe(41800 + 4000 + expectedTip)

    const table = buildOrderTotals({
      items,
      type: 'table',
      deliveryFee: 4000,
      minOrder: 0,
      storeName: 'La Parrilla',
      tipPercent: 0,
    })
    expect(table.ok).toBe(true)
    if (!table.ok) return
    expect(table.totals.deliveryFee).toBe(0)
    expect(table.totals.tip).toBe(0)
    expect(table.totals.total).toBe(41800)
  })

  it('rejects orders under the store minimum with the store name', () => {
    const result = buildOrderTotals({
      items,
      type: 'pickup',
      deliveryFee: 0,
      minOrder: 50000,
      storeName: 'La Parrilla',
      tipPercent: 0,
    })
    expect(result).toEqual({
      ok: false,
      error: 'El pedido mínimo de La Parrilla no se alcanza.',
    })
  })
})

describe('recordPaymentResult', () => {
  interface Written {
    table: string
    payload: Record<string, unknown>
    column: string
    value: string
  }

  interface FakeAdminOptions {
    /** Payment status already stored on the order before this call. */
    currentStatus?: string | null
    error?: { message: string } | null
  }

  /**
   * Minimal service-role client: replays `currentStatus` for the read used
   * by the transition guard and records the update chain.
   */
  function fakeAdmin(options: FakeAdminOptions = {}) {
    const { currentStatus = 'pending', error = null } = options
    const writes: Written[] = []
    const admin = {
      from(table: string) {
        return {
          select: () => ({
            eq: () => ({
              maybeSingle: async () => ({
                data:
                  currentStatus === null ? null : { payment_status: currentStatus },
                error: null,
              }),
            }),
          }),
          update(payload: Record<string, unknown>) {
            return {
              eq: async (column: string, value: string) => {
                writes.push({ table, payload, column, value })
                return { error }
              },
            }
          },
        }
      },
    }
    return { admin: admin as unknown as SupabaseClient<Database>, writes }
  }

  afterEach(() => {
    vi.restoreAllMocks()
  })

  it('cancels the order and reports the gateway message when the payment failed', async () => {
    const { admin, writes } = fakeAdmin()
    const result = await recordPaymentResult(admin, 'order-1', {
      status: 'failed',
      reference: 'mock_ABC',
      message: 'La tarjeta de prueba fue rechazada.',
    })
    expect(result).toEqual({
      failed: true,
      message: 'La tarjeta de prueba fue rechazada.',
    })
    expect(writes).toEqual([
      {
        table: 'orders',
        payload: {
          status: 'cancelled',
          payment_status: 'failed',
          payment_ref: 'mock_ABC',
        },
        column: 'id',
        value: 'order-1',
      },
    ])
  })

  it('falls back to a generic Spanish message when the gateway gives none', async () => {
    const { admin } = fakeAdmin()
    const result = await recordPaymentResult(admin, 'order-1', {
      status: 'failed',
      reference: 'mock_ABC',
    })
    expect(result).toEqual({ failed: true, message: 'El pago fue rechazado.' })
  })

  it('stores the payment status and reference when the payment went through', async () => {
    const { admin, writes } = fakeAdmin()
    const result = await recordPaymentResult(admin, 'order-2', {
      status: 'paid',
      reference: 'mock_DEF',
    })
    expect(result).toEqual({ failed: false })
    expect(writes).toEqual([
      {
        table: 'orders',
        payload: { payment_status: 'paid', payment_ref: 'mock_DEF' },
        column: 'id',
        value: 'order-2',
      },
    ])
  })

  it('logs a database error on either update without throwing', async () => {
    const error = { message: 'permission denied' }
    const log = vi.spyOn(console, 'error').mockImplementation(() => {})
    const { admin } = fakeAdmin({ error })

    await expect(
      recordPaymentResult(admin, 'order-3', { status: 'paid', reference: 'r1' }),
    ).resolves.toEqual({ failed: false })
    await expect(
      recordPaymentResult(admin, 'order-3', { status: 'failed', reference: 'r2' }),
    ).resolves.toEqual({ failed: true, message: 'El pago fue rechazado.' })

    expect(log).toHaveBeenCalledTimes(2)
    expect(log.mock.calls[0]?.[1]).toBe(error)
    expect(log.mock.calls[1]?.[1]).toBe(error)
  })

  it('skips a forbidden transition instead of overwriting a paid order with failed', async () => {
    const log = vi.spyOn(console, 'error').mockImplementation(() => {})
    const { admin, writes } = fakeAdmin({ currentStatus: 'paid' })
    const result = await recordPaymentResult(admin, 'order-4', {
      status: 'failed',
      reference: 'late_webhook',
    })
    expect(result).toEqual({ failed: false })
    expect(writes).toEqual([])
    expect(log).toHaveBeenCalled()
  })

  it('treats a missing current row as pending, allowing the first write', async () => {
    const { admin, writes } = fakeAdmin({ currentStatus: null })
    const result = await recordPaymentResult(admin, 'order-5', {
      status: 'paid',
      reference: 'mock_GHI',
    })
    expect(result).toEqual({ failed: false })
    expect(writes).toHaveLength(1)
  })
})
