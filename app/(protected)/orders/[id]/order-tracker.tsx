'use client'

import { motion, useReducedMotion } from 'framer-motion'
import {
  BikeIcon,
  CheckCheckIcon,
  CheckIcon,
  ChefHatIcon,
  PackageCheckIcon,
  ReceiptTextIcon,
  XIcon,
} from 'lucide-react'
import { useEffect, useState } from 'react'
import { toast } from 'sonner'
import { EtaCountdown } from '@/components/orders/eta-countdown'
import {
  useRealtimeChannel,
  useRealtimeRefresh,
} from '@/components/providers/realtime-provider'
import { ORDER_STATUS_LABELS, ORDER_STATUS_SEQUENCE } from '@/lib/orders/status'
import { cn } from '@/lib/utils'
import type { OrderStatus, OrderType } from '@/types/app'

interface TrackedOrder {
  id: string
  status: OrderStatus
  type: OrderType
  estimated_at: string | null
  accepted_at: string | null
  preparing_at: string | null
  ready_at: string | null
  picked_up_at: string | null
  delivered_at: string | null
  cancelled_at: string | null
  created_at: string
}

interface OrderTrackerProps {
  initial: TrackedOrder
  onStatusChange?: (status: OrderStatus) => void
  /**
   * Subscribe to realtime updates. Anonymous table guests cannot read the
   * order through RLS, so their page polls instead and passes false.
   */
  live?: boolean
}

const STEP_ICONS: Record<OrderStatus, React.ReactNode> = {
  pending: <ReceiptTextIcon aria-hidden="true" className="size-4" />,
  accepted: <CheckIcon aria-hidden="true" className="size-4" />,
  preparing: <ChefHatIcon aria-hidden="true" className="size-4" />,
  ready: <PackageCheckIcon aria-hidden="true" className="size-4" />,
  picked_up: <BikeIcon aria-hidden="true" className="size-4" />,
  delivered: <CheckCheckIcon aria-hidden="true" className="size-4" />,
  cancelled: <XIcon aria-hidden="true" className="size-4" />,
}

const STEP_DESCRIPTIONS: Record<OrderStatus, string> = {
  pending: 'Esperando que el restaurante confirme.',
  accepted: 'El restaurante aceptó tu pedido.',
  preparing: 'La cocina está trabajando en ello.',
  ready: 'Listo para salir o para recoger.',
  picked_up: 'El domiciliario va en camino.',
  delivered: '¡Entregado! Buen provecho.',
  cancelled: 'El pedido fue cancelado.',
}

const timeFormatter = new Intl.DateTimeFormat('es-CO', {
  hour: '2-digit',
  minute: '2-digit',
})

function stampFor(order: TrackedOrder, status: OrderStatus): string | null {
  const map: Record<OrderStatus, string | null> = {
    pending: order.created_at,
    accepted: order.accepted_at,
    preparing: order.preparing_at,
    ready: order.ready_at,
    picked_up: order.picked_up_at,
    delivered: order.delivered_at,
    cancelled: order.cancelled_at,
  }
  return map[status]
}

export function useLiveOrder(
  initial: TrackedOrder,
  enabled = true,
): TrackedOrder {
  const refresh = useRealtimeRefresh()
  const [order, setOrder] = useState(initial)

  useEffect(() => setOrder(initial), [initial])

  useRealtimeChannel({
    name: `order-${initial.id}`,
    table: 'orders',
    event: 'UPDATE',
    filter: `id=eq.${initial.id}`,
    enabled,
    onEvent: (payload) => {
      const next = payload.new as unknown as TrackedOrder
      setOrder((current) => ({ ...current, ...next }))
      if (next.status !== initial.status) {
        toast(ORDER_STATUS_LABELS[next.status], {
          description: STEP_DESCRIPTIONS[next.status],
        })
      }
      // Server components (courier block, review form) refresh too.
      refresh()
    },
  })

  return order
}

export function OrderTimeline({ initial, live = true }: OrderTrackerProps) {
  const order = useLiveOrder(initial, live)
  const reduceMotion = useReducedMotion()

  const steps = ORDER_STATUS_SEQUENCE.filter((status) =>
    order.type === 'delivery' ? true : status !== 'picked_up',
  )
  const cancelled = order.status === 'cancelled'
  const currentIndex = cancelled ? -1 : steps.indexOf(order.status)
  const showEta =
    order.estimated_at && !cancelled && order.status !== 'delivered'

  return (
    <div className="space-y-5">
      {/*
        Not a live region. `useLiveOrder` above already raises a toast on every
        status change, and the toaster is itself a polite live region, so this
        card used to read the same transition out a second time. The card
        stays the page's visible source of truth; the toast is the announcer.

        The ink is the token that belongs with the fill, not `text-white`:
        in the dark ramp the brand orange needs dark ink to clear AA.
      */}
      <div
        className={cn(
          'rounded-card shadow-2 p-card relative overflow-hidden',
          cancelled
            ? 'bg-destructive text-destructive-foreground'
            : 'bg-primary text-primary-foreground',
        )}
      >
        <div className="flex flex-wrap items-end justify-between gap-4">
          {/*
            No `opacity` on this card. Ink at 90% over the brand fill measures
            4.48:1 — a rounding error below AA — and the hierarchy here comes
            from size and case anyway, which costs nothing in contrast.
          */}
          <div className="min-w-0">
            <p className="text-xs font-medium tracking-wide uppercase">
              Estado actual
            </p>
            <p className="text-h2 font-display font-semibold">
              {ORDER_STATUS_LABELS[order.status]}
            </p>
            <p className="text-sm">{STEP_DESCRIPTIONS[order.status]}</p>
          </div>
          {showEta ? (
            <EtaCountdown
              target={order.estimated_at}
              verb={order.type === 'delivery' ? 'Llega' : 'Listo'}
              className="shrink-0 text-right"
            />
          ) : null}
        </div>
      </div>

      {cancelled ? null : (
        <ol className="rounded-card border-border bg-card shadow-1 p-card relative space-y-0 border">
          {steps.map((status, index) => {
            const done = index < currentIndex
            const active = index === currentIndex
            const stamp = stampFor(order, status)
            return (
              <li key={status} className="relative flex gap-4 pb-6 last:pb-0">
                {index < steps.length - 1 ? (
                  <span
                    aria-hidden="true"
                    className="bg-border absolute top-9 left-[15px] h-[calc(100%-1.25rem)] w-0.5"
                  >
                    {/*
                      The line grows rather than appearing: it is the one
                      piece of motion on the page that carries meaning —
                      progress — and the reduced-motion path still leaves the
                      completed segment filled.
                    */}
                    <motion.span
                      className="bg-primary block w-full origin-top"
                      initial={false}
                      animate={{ scaleY: done ? 1 : 0 }}
                      transition={
                        reduceMotion
                          ? { duration: 0 }
                          : { duration: 0.6, ease: 'easeOut' }
                      }
                      style={{ height: '100%' }}
                    />
                  </span>
                ) : null}
                <motion.span
                  initial={false}
                  animate={
                    active && !reduceMotion
                      ? { scale: [1, 1.12, 1] }
                      : { scale: 1 }
                  }
                  transition={{ repeat: active ? Infinity : 0, duration: 1.8 }}
                  className={cn(
                    'ring-card relative z-10 flex size-8 shrink-0 items-center justify-center rounded-full ring-4',
                    done
                      ? 'bg-primary text-primary-foreground'
                      : active
                        ? 'bg-primary text-primary-foreground shadow-2'
                        : 'bg-muted text-muted-foreground',
                  )}
                >
                  {done ? (
                    <CheckIcon aria-hidden="true" className="size-4" />
                  ) : (
                    STEP_ICONS[status]
                  )}
                </motion.span>
                <div className="min-w-0 pt-1">
                  <p
                    className={cn(
                      'text-sm font-semibold',
                      !done && !active && 'text-muted-foreground',
                    )}
                  >
                    {ORDER_STATUS_LABELS[status]}
                  </p>
                  <p className="text-muted-foreground text-xs">
                    {stamp && (done || active)
                      ? timeFormatter.format(new Date(stamp))
                      : STEP_DESCRIPTIONS[status]}
                  </p>
                </div>
              </li>
            )
          })}
        </ol>
      )}
    </div>
  )
}
