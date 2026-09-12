'use client'

import { create } from 'zustand'
import { createJSONStorage, persist } from 'zustand/middleware'
import {
  EMPTY_CART,
  addItem,
  cartQuantity,
  cartSubtotal,
  removeItem,
  setItemQuantity,
  setTableContext,
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
          ...addItem(state, store, item, quantity),
          lastAddedAt: Date.now(),
        })),
      setQuantity: (key, quantity) =>
        set((state) => setItemQuantity(state, key, quantity)),
      remove: (key) => set((state) => removeItem(state, key)),
      clear: () => set({ ...EMPTY_CART }),
      setTable: (store, table) =>
        set((state) => setTableContext(state, store, table)),
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
    },
  ),
)

export const selectCartQuantity = (state: CartStore) => cartQuantity(state)
export const selectCartSubtotal = (state: CartStore) => cartSubtotal(state)
