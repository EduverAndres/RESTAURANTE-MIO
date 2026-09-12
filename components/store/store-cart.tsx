'use client'

import { CartFab } from '@/components/store/cart-fab'
import { CartSheet } from '@/components/store/cart-sheet'
import type { StoreTheme } from '@/types/app'

interface StoreCartProps {
  minOrder: number | null
  storeName: string
  theme: StoreTheme
}

/**
 * The cart surfaces, mounted once per storefront. They live next to the
 * sections rather than inside the menu so that a theme whose `sectionOrder`
 * puts the menu last still shows the floating cart from the first screen.
 */
export function StoreCart({ minOrder, storeName, theme }: StoreCartProps) {
  return (
    <>
      <CartSheet minOrder={minOrder} storeName={storeName} theme={theme} />
      <CartFab />
    </>
  )
}
