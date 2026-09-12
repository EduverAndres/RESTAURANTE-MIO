'use client'

import { useEffect } from 'react'
import type { CartTable } from '@/lib/cart'
import { useCartStore } from '@/stores/cart.store'

interface TableContextSetterProps {
  storeId: string
  storeSlug: string
  table: CartTable
}

/**
 * Tags the persisted cart with the scanned table as soon as the entry page
 * mounts, so a cart started earlier at this store checks out at the table.
 *
 * It also mirrors `data-table-mode` onto `<html>`. The storefront shell
 * already carries that attribute server-side, which is what makes the first
 * paint large; the copy on the root element is what reaches the cart sheet
 * and the product drawer, whose markup Radix and vaul portal to
 * `document.body`, outside the storefront subtree.
 */
export function TableContextSetter({
  storeId,
  storeSlug,
  table,
}: TableContextSetterProps) {
  const setTable = useCartStore((state) => state.setTable)
  const { number, token } = table

  useEffect(() => {
    setTable({ storeId, storeSlug }, { number, token })
  }, [setTable, storeId, storeSlug, number, token])

  useEffect(() => {
    const root = document.documentElement
    root.setAttribute('data-table-mode', '')
    return () => root.removeAttribute('data-table-mode')
  }, [])

  return null
}
