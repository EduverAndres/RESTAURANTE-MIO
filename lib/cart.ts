// Pure cart reducer. The Zustand store in stores/cart.store.ts wraps these
// functions so the logic can be unit-tested without React.
import { computeLineTotal } from '@/lib/pricing'
import type { OrderItemOption } from '@/types/app'

export interface CartItem {
  /** Stable identity: product + options + notes. */
  key: string
  productId: string
  name: string
  unitPrice: number
  imageUrl: string | null
  options: OrderItemOption[]
  /** Selected product_option_values ids, sent to the server for re-pricing. */
  optionValueIds: string[]
  notes: string
  quantity: number
}

/** Dine-in context set when the visitor arrived through a table QR code. */
export interface CartTable {
  number: number
  token: string
  /** Epoch ms of the last time a table page tagged the cart. */
  taggedAt?: number
}

/**
 * How long a scanned table keeps tagging the cart. A meal is well inside it;
 * the next visit from home is not. Before this the tag never expired: someone
 * who scanned a table and left without ordering opened the store days later
 * and "Ir a pagar" sent them to that table's checkout.
 */
export const TABLE_CONTEXT_TTL_MS = 4 * 60 * 60 * 1000

/**
 * The table tag if it is still fresh, else null. A tag without a time comes
 * from a cart saved before tags expired, so its age is unknown: dropped. A
 * table page re-tags the cart as soon as it opens, so a guest still seated
 * loses nothing.
 */
export function freshTable(
  table: CartTable | null | undefined,
  now: number,
): CartTable | null {
  if (!table || typeof table.taggedAt !== 'number') return null
  return now - table.taggedAt <= TABLE_CONTEXT_TTL_MS ? table : null
}

/** Stamps a table that has no time yet (a new tag) with `now`. */
export function stampTable(state: CartState, now: number): CartState {
  if (!state.table || typeof state.table.taggedAt === 'number') return state
  return { ...state, table: { ...state.table, taggedAt: now } }
}

export interface CartState {
  storeId: string | null
  storeSlug: string | null
  table: CartTable | null
  items: CartItem[]
}

export interface CartStoreRef {
  storeId: string
  storeSlug: string
  /** When present, the add happened from a table page and tags the cart. */
  table?: CartTable | null
}

export type CartItemInput = Omit<CartItem, 'key' | 'quantity'>

export const EMPTY_CART: CartState = {
  storeId: null,
  storeSlug: null,
  table: null,
  items: [],
}

function sortedOptions(options: OrderItemOption[]): OrderItemOption[] {
  return [...options].sort((a, b) =>
    `${a.option}:${a.value}`.localeCompare(`${b.option}:${b.value}`),
  )
}

export function cartItemKey(item: CartItemInput): string {
  const options = sortedOptions(item.options)
    .map((option) => `${option.option}=${option.value}`)
    .join('|')
  return `${item.productId}::${options}::${item.notes.trim().toLowerCase()}`
}

export function addItem(
  state: CartState,
  store: CartStoreRef,
  input: CartItemInput,
  quantity: number,
): CartState {
  const sameStore = state.storeId === store.storeId
  const base = sameStore ? state : EMPTY_CART
  const key = cartItemKey(input)
  const existing = base.items.find((item) => item.key === key)
  const items = existing
    ? base.items.map((item) =>
        item.key === key
          ? { ...item, quantity: item.quantity + quantity }
          : item,
      )
    : [...base.items, { ...input, key, quantity }]
  // A table given by the caller wins; otherwise the context survives adds
  // from the same store and is dropped when the cart switches store.
  const table = store.table ?? (sameStore ? state.table : null)
  return { storeId: store.storeId, storeSlug: store.storeSlug, table, items }
}

/**
 * Tags the cart with a table (or clears it). A cart that belongs to another
 * store is replaced, mirroring addItem: scanning a QR code means the visitor
 * is now ordering from that store.
 */
export function setTableContext(
  state: CartState,
  store: CartStoreRef,
  table: CartTable | null,
): CartState {
  if (state.storeId === store.storeId) return { ...state, table }
  return {
    storeId: store.storeId,
    storeSlug: store.storeSlug,
    table,
    items: [],
  }
}

function withItems(state: CartState, items: CartItem[]): CartState {
  return items.length === 0 ? EMPTY_CART : { ...state, items }
}

export function setItemQuantity(
  state: CartState,
  key: string,
  quantity: number,
): CartState {
  if (quantity <= 0) return removeItem(state, key)
  return withItems(
    state,
    state.items.map((item) =>
      item.key === key ? { ...item, quantity } : item,
    ),
  )
}

export function removeItem(state: CartState, key: string): CartState {
  return withItems(
    state,
    state.items.filter((item) => item.key !== key),
  )
}

export function cartQuantity(state: CartState): number {
  return state.items.reduce((sum, item) => sum + item.quantity, 0)
}

export function cartSubtotal(state: CartState): number {
  return state.items.reduce((sum, item) => sum + computeLineTotal(item), 0)
}
