import { describe, expect, it } from 'vitest'
import { rebuildCartFromOrder, type ReorderProduct } from '@/lib/orders/reorder'

const STORE = 'store-1'

const arepa: ReorderProduct = {
  id: 'p-arepa',
  name: 'Arepa de huevo',
  price: 6000,
  image_url: 'https://x/arepa.jpg',
  is_available: true,
  store_id: STORE,
  product_options: [
    {
      id: 'o-salsa',
      name: 'Salsa',
      required: true,
      min: 1,
      max: 1,
      product_option_values: [
        { id: 'v-rosada', name: 'Rosada', price_delta: 0 },
        { id: 'v-pina', name: 'Piña', price_delta: 500 },
      ],
    },
  ],
}

const jugo: ReorderProduct = {
  id: 'p-jugo',
  name: 'Jugo de corozo',
  price: '5000',
  image_url: null,
  is_available: true,
  store_id: STORE,
  product_options: [],
}

const line = (
  overrides: Partial<Parameters<typeof rebuildCartFromOrder>[0][number]>,
) => ({
  product_id: 'p-arepa',
  name_snapshot: 'Arepa de huevo',
  quantity: 2,
  options: [{ option: 'Salsa', value: 'Piña', price_delta: 300 }],
  ...overrides,
})

describe('rebuildCartFromOrder', () => {
  it('rebuilds each line at today’s prices with the matching option ids', () => {
    const result = rebuildCartFromOrder(
      [
        line({}),
        line({
          product_id: 'p-jugo',
          name_snapshot: 'Jugo de corozo',
          quantity: 1,
          options: [],
        }),
      ],
      [arepa, jugo],
      STORE,
    )
    expect(result.skipped).toEqual([])
    expect(result.items).toEqual([
      {
        productId: 'p-arepa',
        name: 'Arepa de huevo',
        unitPrice: 6000,
        imageUrl: 'https://x/arepa.jpg',
        // The delta is today's (500), not the one paid back then (300).
        options: [{ option: 'Salsa', value: 'Piña', price_delta: 500 }],
        optionValueIds: ['v-pina'],
        notes: '',
        quantity: 2,
      },
      {
        productId: 'p-jugo',
        name: 'Jugo de corozo',
        unitPrice: 5000,
        imageUrl: null,
        options: [],
        optionValueIds: [],
        notes: '',
        quantity: 1,
      },
    ])
  })

  it('skips products that are gone, paused or from another store', () => {
    const result = rebuildCartFromOrder(
      [
        line({ product_id: 'p-borrado', name_snapshot: 'Patacón' }),
        line({ product_id: null, name_snapshot: 'Producto viejo' }),
        line({
          product_id: 'p-jugo',
          name_snapshot: 'Jugo de corozo',
          options: [],
        }),
        line({ product_id: 'p-otra', name_snapshot: 'Ajena', options: [] }),
      ],
      [
        { ...jugo, is_available: false },
        { ...jugo, id: 'p-otra', name: 'Ajena', store_id: 'store-2' },
      ],
      STORE,
    )
    expect(result.items).toEqual([])
    expect(result.skipped).toEqual([
      'Patacón',
      'Producto viejo',
      'Jugo de corozo',
      'Ajena',
    ])
  })

  it('skips a line whose chosen option no longer exists', () => {
    const result = rebuildCartFromOrder(
      [
        line({
          options: [{ option: 'Salsa', value: 'Tártara', price_delta: 0 }],
        }),
      ],
      [arepa],
      STORE,
    )
    expect(result.items).toEqual([])
    expect(result.skipped).toEqual(['Arepa de huevo'])
  })

  it('skips a line that no longer satisfies a required option', () => {
    const result = rebuildCartFromOrder([line({ options: [] })], [arepa], STORE)
    expect(result.items).toEqual([])
    expect(result.skipped).toEqual(['Arepa de huevo'])
  })

  it('reads a malformed options snapshot as no options', () => {
    const result = rebuildCartFromOrder(
      [
        line({
          product_id: 'p-jugo',
          name_snapshot: 'Jugo de corozo',
          options: 'nope',
        }),
      ],
      [jugo],
      STORE,
    )
    expect(result.items).toHaveLength(1)
    expect(result.skipped).toEqual([])
  })
})
