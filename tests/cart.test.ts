import { describe, expect, it } from 'vitest'
import {
  EMPTY_CART,
  addItem,
  cartItemKey,
  cartQuantity,
  cartSubtotal,
  removeItem,
  setItemQuantity,
  setTableContext,
  type CartItem,
  type CartState,
} from '@/lib/cart'

const empty: CartState = {
  storeId: null,
  storeSlug: null,
  table: null,
  items: [],
}
const mesa = { number: 4, token: '0123456789abcdef01234567' }

const burger: Omit<CartItem, 'key' | 'quantity'> = {
  productId: 'p1',
  name: 'Hamburguesa',
  unitPrice: 18900,
  imageUrl: null,
  options: [],
  optionValueIds: [],
  notes: '',
}

describe('cartItemKey', () => {
  it('is stable for the same product, options and notes', () => {
    const a = cartItemKey({
      ...burger,
      options: [{ option: 'T', value: 'G', price_delta: 1 }],
    })
    const b = cartItemKey({
      ...burger,
      options: [{ option: 'T', value: 'G', price_delta: 1 }],
    })
    expect(a).toBe(b)
  })

  it('differs when options or notes differ', () => {
    expect(cartItemKey(burger)).not.toBe(
      cartItemKey({ ...burger, notes: 'sin cebolla' }),
    )
  })
})

describe('addItem', () => {
  it('starts a cart for the store and adds the item', () => {
    const next = addItem(
      empty,
      { storeId: 's1', storeSlug: 'la-parrilla' },
      burger,
      2,
    )
    expect(next.storeId).toBe('s1')
    expect(next.items).toHaveLength(1)
    expect(next.items[0].quantity).toBe(2)
  })

  it('merges identical items by increasing the quantity', () => {
    const once = addItem(empty, { storeId: 's1', storeSlug: 'x' }, burger, 1)
    const twice = addItem(once, { storeId: 's1', storeSlug: 'x' }, burger, 2)
    expect(twice.items).toHaveLength(1)
    expect(twice.items[0].quantity).toBe(3)
  })

  it('replaces the cart when adding from another store', () => {
    const once = addItem(empty, { storeId: 's1', storeSlug: 'x' }, burger, 1)
    const other = addItem(
      once,
      { storeId: 's2', storeSlug: 'y' },
      { ...burger, productId: 'p9' },
      1,
    )
    expect(other.storeId).toBe('s2')
    expect(other.items).toHaveLength(1)
    expect(other.items[0].productId).toBe('p9')
  })
})

describe('setItemQuantity and removeItem', () => {
  const cart = addItem(empty, { storeId: 's1', storeSlug: 'x' }, burger, 1)
  const key = cart.items[0].key

  it('updates the quantity', () => {
    expect(setItemQuantity(cart, key, 4).items[0].quantity).toBe(4)
  })

  it('removes the item when quantity drops to zero', () => {
    expect(setItemQuantity(cart, key, 0).items).toHaveLength(0)
  })

  it('removes by key and clears the store when empty', () => {
    const next = removeItem(cart, key)
    expect(next.items).toHaveLength(0)
    expect(next.storeId).toBeNull()
  })
})

describe('totals', () => {
  it('computes quantity and subtotal including option deltas', () => {
    let cart = addItem(empty, { storeId: 's1', storeSlug: 'x' }, burger, 2)
    cart = addItem(
      cart,
      { storeId: 's1', storeSlug: 'x' },
      {
        ...burger,
        productId: 'p2',
        unitPrice: 5000,
        options: [{ option: 'E', value: 'Q', price_delta: 1000 }],
      },
      1,
    )
    expect(cartQuantity(cart)).toBe(3)
    expect(cartSubtotal(cart)).toBe(18900 * 2 + 6000)
  })
})

describe('table context', () => {
  it('starts without a table', () => {
    expect(EMPTY_CART.table).toBeNull()
  })

  it('carries the table given by the store ref when adding', () => {
    const next = addItem(
      empty,
      { storeId: 's1', storeSlug: 'x', table: mesa },
      burger,
      1,
    )
    expect(next.table).toEqual(mesa)
  })

  it('keeps the table on later adds from the same store without a ref', () => {
    const first = addItem(
      empty,
      { storeId: 's1', storeSlug: 'x', table: mesa },
      burger,
      1,
    )
    const second = addItem(first, { storeId: 's1', storeSlug: 'x' }, burger, 1)
    expect(second.table).toEqual(mesa)
  })

  it('clears the table when the store changes', () => {
    const first = addItem(
      empty,
      { storeId: 's1', storeSlug: 'x', table: mesa },
      burger,
      1,
    )
    const other = addItem(
      first,
      { storeId: 's2', storeSlug: 'y' },
      { ...burger, productId: 'p9' },
      1,
    )
    expect(other.table).toBeNull()
  })

  it('sets the table on an existing cart of the same store', () => {
    const cart = addItem(empty, { storeId: 's1', storeSlug: 'x' }, burger, 2)
    const next = setTableContext(cart, { storeId: 's1', storeSlug: 'x' }, mesa)
    expect(next.table).toEqual(mesa)
    expect(next.items).toHaveLength(1)
  })

  it('starts a fresh cart for the table store when the cart belongs elsewhere', () => {
    const cart = addItem(empty, { storeId: 's1', storeSlug: 'x' }, burger, 2)
    const next = setTableContext(cart, { storeId: 's2', storeSlug: 'y' }, mesa)
    expect(next).toEqual({
      storeId: 's2',
      storeSlug: 'y',
      table: mesa,
      items: [],
    })
  })

  it('can drop the table again', () => {
    const cart = addItem(
      empty,
      { storeId: 's1', storeSlug: 'x', table: mesa },
      burger,
      1,
    )
    expect(
      setTableContext(cart, { storeId: 's1', storeSlug: 'x' }, null).table,
    ).toBeNull()
  })
})
