'use client'

import { useEffect, useRef, useState } from 'react'
import { consumeOrderJustPlaced } from '@/lib/orders/just-placed'

/** Length of the tick path, so the dash animation fits it exactly. */
const CHECK_LENGTH = 36

function DrawnCheck() {
  return (
    <span className="animate-check-pop bg-success/12 grid size-20 place-items-center rounded-full">
      <svg
        viewBox="0 0 48 48"
        aria-hidden="true"
        className="text-success-on-tint size-12"
        fill="none"
      >
        <path
          d="M13 24.5 21 32 35 17"
          stroke="currentColor"
          strokeWidth="4"
          strokeLinecap="round"
          strokeLinejoin="round"
          className="animate-check-draw"
          style={{
            strokeDasharray: CHECK_LENGTH,
            // Consumed by the `check-draw` keyframes in globals.css.
            ['--check-length' as string]: CHECK_LENGTH,
          }}
        />
      </svg>
    </span>
  )
}

/**
 * The moment after paying.
 *
 * It renders only for the person who just placed this order — the checkout
 * leaves a one-shot flag in session storage — so a shared link, a refresh or
 * a return visit shows the plain tracking page. The tick draws itself and the
 * order number is set in display type, because for the next two days that
 * number is the thing the customer will be asked for.
 */
export function OrderConfirmation({
  orderId,
  shortCode,
}: {
  orderId: string
  shortCode: string
}) {
  const [show, setShow] = useState(false)
  // The flag is spent on read, and in development React mounts every effect
  // twice — without this guard the second pass would find nothing left and
  // immediately hide the panel the first pass had just shown.
  const checked = useRef<string | null>(null)

  useEffect(() => {
    if (checked.current === orderId) return
    checked.current = orderId
    setShow(consumeOrderJustPlaced(orderId))
  }, [orderId])

  if (!show) return null

  return (
    <div
      role="status"
      className="rounded-card border-success/30 bg-success/8 p-card mb-8 flex flex-col items-center gap-3 border text-center"
    >
      <DrawnCheck />
      <p className="text-h3 font-display font-semibold">¡Pedido confirmado!</p>
      <p className="text-muted-foreground text-sm">
        Guarda este número por si necesitas hablar con el restaurante.
      </p>
      <p className="text-display font-display font-display-soft font-semibold tabular-nums">
        #{shortCode}
      </p>
    </div>
  )
}
