'use client'

import { RotateCcwIcon } from 'lucide-react'
import { useRouter } from 'next/navigation'
import { useTransition } from 'react'
import { toast } from 'sonner'
import { prepareReorder } from './actions'
import { Button } from '@/components/ui/button'
import { useCartStore } from '@/stores/cart.store'

/** "Patacón, Jugo de corozo y Arepa" */
function listNames(names: readonly string[]): string {
  if (names.length <= 1) return names[0] ?? ''
  return `${names.slice(0, -1).join(', ')} y ${names.at(-1)}`
}

/**
 * Puts a past order back in the cart and opens it on the store's page, where
 * the customer can still change anything before paying.
 *
 * It goes through the cart's own `add`, so it behaves like adding by hand: it
 * joins a cart from the same store and replaces one from another store. Lines
 * that could not be brought back are named in a toast instead of vanishing.
 */
export function RepeatOrderButton({ orderId }: { orderId: string }) {
  const router = useRouter()
  const [pending, startTransition] = useTransition()
  const add = useCartStore((state) => state.add)
  const setOpen = useCartStore((state) => state.setOpen)

  function repeat() {
    startTransition(async () => {
      const result = await prepareReorder(orderId)
      if (!result.ok) {
        toast.error(result.error)
        return
      }
      if (result.items.length === 0) {
        toast.error(
          'Ninguno de los productos de este pedido está disponible hoy.',
        )
        return
      }

      const store = { storeId: result.storeId, storeSlug: result.storeSlug }
      for (const { quantity, ...item } of result.items)
        add(store, item, quantity)
      if (result.skipped.length > 0) {
        toast(
          result.skipped.length === 1
            ? `No agregamos ${listNames(result.skipped)}: ya no está disponible o cambió.`
            : `No agregamos ${listNames(result.skipped)}: ya no están disponibles o cambiaron.`,
        )
      }
      setOpen(true)
      router.push(`/t/${result.storeSlug}`)
    })
  }

  return (
    <Button
      type="button"
      variant="outline"
      className="rounded-pill"
      onClick={repeat}
      disabled={pending}
    >
      <RotateCcwIcon aria-hidden="true" />
      {pending ? 'Preparando tu carrito…' : 'Repetir pedido'}
    </Button>
  )
}
