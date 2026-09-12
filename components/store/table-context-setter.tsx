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

  return null
}
