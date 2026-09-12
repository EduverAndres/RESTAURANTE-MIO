'use client'

import {
  LoaderCircleIcon,
  MapPinIcon,
  RouteIcon,
  StoreIcon,
} from 'lucide-react'
import { useRouter } from 'next/navigation'
import { useTransition } from 'react'
import { toast } from 'sonner'
import { claimOrder } from '@/app/courier/actions'
import { Button } from '@/components/ui/button'
import type { CourierOrderSummary } from '@/lib/courier/orders'
import { formatCOP } from '@/lib/format'
import { formatDistance } from '@/lib/geo'

const timeFormatter = new Intl.DateTimeFormat('es-CO', {
  hour: '2-digit',
  minute: '2-digit',
})

export function AvailableOrderCard({ order }: { order: CourierOrderSummary }) {
  const router = useRouter()
  const [pending, startTransition] = useTransition()

  function claim() {
    startTransition(async () => {
      const result = await claimOrder(order.id)
      if (!result.ok) {
        toast.error(result.error)
        router.refresh()
        return
      }
      toast.success('Pedido asignado. ¡A rodar!')
      router.push(`/courier/${order.id}`)
    })
  }

  return (
    <article
      aria-label={`Pedido #${order.shortCode}`}
      className="rounded-card border-border bg-card shadow-soft space-y-3 border p-4"
    >
      <header className="flex items-start justify-between gap-3">
        <div className="min-w-0">
          <p className="text-muted-foreground font-mono text-xs">
            #{order.shortCode} ·{' '}
            {timeFormatter.format(new Date(order.createdAt))}
          </p>
          <p className="flex items-center gap-1.5 font-semibold">
            <StoreIcon aria-hidden="true" className="text-primary size-4" />
            <span className="truncate">{order.storeName}</span>
          </p>
        </div>
        <p className="text-right">
          <span className="text-muted-foreground block text-xs">Ganas</span>
          <span className="font-display text-lg font-semibold tabular-nums">
            {formatCOP(order.deliveryFee)}
          </span>
        </p>
      </header>

      <dl className="space-y-1 text-sm">
        <div className="flex items-start gap-1.5">
          <dt className="sr-only">Dirección</dt>
          <MapPinIcon
            aria-hidden="true"
            className="text-muted-foreground mt-0.5 size-4 shrink-0"
          />
          <dd className="text-muted-foreground">
            {order.addressLine ?? 'Dirección disponible al tomar el pedido'}
          </dd>
        </div>
        <div className="flex items-center gap-1.5">
          <dt className="sr-only">Distancia</dt>
          <RouteIcon
            aria-hidden="true"
            className="text-muted-foreground size-4 shrink-0"
          />
          <dd className="text-muted-foreground">
            {order.distanceKm !== null
              ? `${formatDistance(order.distanceKm)} en línea recta`
              : 'Distancia no disponible'}
          </dd>
        </div>
      </dl>

      <Button
        type="button"
        onClick={claim}
        disabled={pending}
        className="rounded-pill w-full"
      >
        {pending ? (
          <LoaderCircleIcon aria-hidden="true" className="animate-spin" />
        ) : null}
        Tomar pedido
      </Button>
    </article>
  )
}
