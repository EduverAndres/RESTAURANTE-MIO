'use client'

import { create } from 'zustand'

interface MenuSearchState {
  query: string
  setQuery: (query: string) => void
  reset: () => void
}

/**
 * The in-menu search term, shared by the header (which owns the input) and the
 * menu (which owns the list). A store rather than a context because the two
 * live in separate client islands under a server-rendered page, and threading
 * a provider around every section would make the whole storefront a client
 * component for the sake of one string.
 */
export const useMenuSearch = create<MenuSearchState>((set) => ({
  query: '',
  setQuery: (query) => set({ query }),
  reset: () => set({ query: '' }),
}))
