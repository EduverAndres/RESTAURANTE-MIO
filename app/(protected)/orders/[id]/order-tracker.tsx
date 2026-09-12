'use client'

import { motion, useReducedMotion } from 'framer-motion'
import {
  BikeIcon,
  CheckCheckIcon,
  CheckIcon,
  ChefHatIcon,
  ClockIcon,
  PackageCheckIcon,
  ReceiptTextIcon,
  XIcon,
} from 'lucide-react'
import { useRouter } from 'next/navigation'
import { useEffect, useState } from 'react'
import { toast } from 'sonner'
import { ORDER_STATUS_LABELS, ORDER_STATUS_SEQUENCE } from '@/lib/orders/status'
import { createClient } from '@/lib/supabase/client'
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
  const router = useRouter()
  const [order, setOrder] = useState(initial)

  useEffect(() => setOrder(initial), [initial])

  useEffect(() => {
    if (!enabled) return
    const supabase = createClient()
    const channel = supabase
      .channel(`order-${initial.id}`)
      .on(
        'postgres_changes',
        {
          event: 'UPDATE',
          schema: 'public',
          table: 'orders',
          filter: `id=eq.${initial.id}`,
        },
        (payload) => {
          const next = payload.new as TrackedOrder
          setOrder((current) => ({ ...current, ...next }))
          if (next.status !== initial.status) {
            toast(ORDER_STATUS_LABELS[next.status], {
              description: STEP_DESCRIPTIONS[next.status],
            })
          }
          // Server components (courier block, review form) refresh too.
          router.refresh()
        },
      )
      .subscribe()
    return () => {
      supabase.removeChannel(channel)
    }
  }, [enabled, initial.id, initial.status, router])

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
  const eta = order.estimated_at ? new Date(order.estimated_at) : null
  const showEta = eta && !cancelled && order.status !== 'delivered'

  return (
    <div className="space-y-6">
      <div
        role="status"
        aria-live="polite"
        className={cn(
          'rounded-card shadow-lift p-5 text-white',
          cancelled ? 'bg-destructive' : 'bg-primary',
        )}
      >
        <p className="text-sm opacity-90">Estado actual</p>
        <p className="font-display text-3xl font-semibold">
          {ORDER_STATUS_LABELS[order.status]}
        </p>
        <p className="text-sm opacity-90">{STEP_DESCRIPTIONS[order.status]}</p>
        {showEta ? (
          <p className="rounded-pill mt-3 inline-flex items-center gap-1.5 bg-white/15 px-3 py-1 text-sm">
            <ClockIcon aria-hidden="true" className="size-4" />
            {order.type === 'delivery'
              ? 'Llega alrededor de'
              : 'Listo alrededor de'}{' '}
            las {timeFormatter.format(eta)}
          </p>
        ) : null}
      </div>

      {cancelled ? null : (
        <ol className="relative space-y-0">
          {steps.map((status, index) => {
            const done = index < currentIndex
            const active = index === currentIndex
            const stamp = stampFor(order, status)
            return (
              <li key={status} className="relative flex gap-4 pb-6 last:pb-0">
                {index < steps.length - 1 ? (
                  <span
                    aria-hidden="true"
                    className="bg-border absolute top-8 left-4 h-[calc(100%-1rem)] w-0.5"
                  >
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
                    'ring-background relative z-10 flex size-8 shrink-0 items-center justify-center rounded-full ring-4',
                    done
                      ? 'bg-primary text-primary-foreground'
                      : active
                        ? 'bg-primary text-primary-foreground shadow-lift'
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
