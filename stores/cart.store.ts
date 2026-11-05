'use client'

import { create } from 'zustand'
import { createJSONStorage, persist } from 'zustand/middleware'
import {
  EMPTY_CART,
  addItem,
  cartQuantity,
  cartSubtotal,
  freshTable,
  removeItem,
  setItemQuantity,
  setTableContext,
  stampTable,
  type CartItemInput,
  type CartState,
  type CartStoreRef,
  type CartTable,
} from '@/lib/cart'

interface CartActions {
  add: (store: CartStoreRef, item: CartItemInput, quantity: number) => void
  setQuantity: (key: string, quantity: number) => void
  remove: (key: string) => void
  clear: () => void
  /** Tags the cart with the table the visitor scanned (null to leave it). */
  setTable: (store: CartStoreRef, table: CartTable | null) => void
  /** UI state: the slide-over cart panel. */
  isOpen: boolean
  setOpen: (open: boolean) => void
  /** Bumps whenever an item is added so the FAB can animate. */
  lastAddedAt: number
}

export type CartStore = CartState & CartActions

export const useCartStore = create<CartStore>()(
  persist(
    (set) => ({
      ...EMPTY_CART,
      isOpen: false,
      lastAddedAt: 0,
      add: (store, item, quantity) =>
        set((state) => ({
          ...stampTable(addItem(state, store, item, quantity), Date.now()),
          lastAddedAt: Date.now(),
        })),
      setQuantity: (key, quantity) =>
        set((state) => setItemQuantity(state, key, quantity)),
      remove: (key) => set((state) => removeItem(state, key)),
      clear: () => set({ ...EMPTY_CART }),
      // A table page passes the table without a time: this is a new tag.
      setTable: (store, table) =>
        set((state) =>
          stampTable(
            setTableContext(
              state,
              store,
              table && { number: table.number, token: table.token },
            ),
            Date.now(),
          ),
        ),
      setOpen: (isOpen) => set({ isOpen }),
    }),
    {
      name: 'tienda-cart',
      storage: createJSONStorage(() => localStorage),
      partialize: (state) => ({
        storeId: state.storeId,
        storeSlug: state.storeSlug,
        table: state.table ?? null,
        items: state.items,
      }),
      // A table tag older than TABLE_CONTEXT_TTL_MS is dropped on load.
      merge: (persisted, current) => {
        const saved = (persisted ?? {}) as Partial<CartState>
        return {
          ...current,
          ...saved,
          table: freshTable(saved.table, Date.now()),
        }
      },
    },
  ),
)

export const selectCartQuantity = (state: CartStore) => cartQuantity(state)
export const selectCartSubtotal = (state: CartStore) => cartSubtotal(state)
