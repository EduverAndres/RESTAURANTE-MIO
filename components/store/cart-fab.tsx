'use client'

import { AnimatePresence, motion, useReducedMotion } from 'framer-motion'
import { ShoppingBagIcon } from 'lucide-react'
import { useEffect, useState } from 'react'
import { formatCOP } from '@/lib/format'
import {
  selectCartQuantity,
  selectCartSubtotal,
  useCartStore,
} from '@/stores/cart.store'

/** Floating cart button with count and total; bounces when an item is added. */
export function CartFab() {
  const quantity = useCartStore(selectCartQuantity)
  const subtotal = useCartStore(selectCartSubtotal)
  const lastAddedAt = useCartStore((state) => state.lastAddedAt)
  const setOpen = useCartStore((state) => state.setOpen)
  const reduceMotion = useReducedMotion()
  const [hydrated, setHydrated] = useState(false)

  // The persisted cart is only known on the client.
  useEffect(() => setHydrated(true), [])

  return (
    <AnimatePresence>
      {hydrated && quantity > 0 ? (
        <motion.button
          key="cart-fab"
          type="button"
          onClick={() => setOpen(true)}
          aria-label={`Abrir carrito, ${quantity} productos, ${formatCOP(subtotal)}`}
          initial={reduceMotion ? false : { y: 80, opacity: 0 }}
          animate={
            reduceMotion
              ? { opacity: 1 }
              : { y: 0, opacity: 1, scale: [1, 1.08, 1] }
          }
          exit={reduceMotion ? { opacity: 0 } : { y: 80, opacity: 0 }}
          // A spring accepts exactly two keyframes, so the three-step scale
          // pop gets its own tween. Sharing one spring threw at runtime and
          // left the button stuck mid-animation.
          transition={{
            y: { type: 'spring', stiffness: 380, damping: 26 },
            opacity: { duration: 0.18 },
            scale: { duration: 0.4, times: [0, 0.45, 1], ease: 'easeOut' },
          }}
          // Re-run the scale keyframes on every add.
          data-added={lastAddedAt}
          data-table-primary=""
          className="rounded-pill shadow-lift fixed bottom-20 left-1/2 z-40 flex -translate-x-1/2 items-center gap-3 bg-[var(--store-primary,var(--primary))] py-3 pr-5 pl-4 text-[var(--store-on-primary,white)] md:right-6 md:bottom-6 md:left-auto md:translate-x-0"
        >
          <span className="relative">
            <ShoppingBagIcon aria-hidden="true" className="size-5" />
            <motion.span
              key={lastAddedAt}
              initial={reduceMotion ? false : { scale: 0.6 }}
              animate={{ scale: 1 }}
              transition={{ type: 'spring', stiffness: 500, damping: 18 }}
              className="absolute -top-2 -right-2 flex size-5 items-center justify-center rounded-full bg-[var(--store-on-primary,white)] text-[11px] font-bold text-[var(--store-primary,var(--primary))]"
            >
              {quantity}
            </motion.span>
          </span>
          <span className="text-sm font-semibold">Ver carrito</span>
          {/* No opacity: 90% white on the brand colour fell under 4.5:1. */}
          <span className="text-sm tabular-nums">{formatCOP(subtotal)}</span>
        </motion.button>
      ) : null}
    </AnimatePresence>
  )
}
