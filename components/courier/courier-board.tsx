'use client'

import { useState } from 'react'
import { AvailableOrderCard } from '@/components/courier/available-order-card'
import { DeliveryCard } from '@/components/courier/delivery-card'
import { OnlineSwitch } from '@/components/courier/online-switch'
import { useCourierPool } from '@/components/courier/use-courier-realtime'
import { useGeolocationPublisher } from '@/components/courier/use-geolocation-publisher'
import { Badge } from '@/components/ui/badge'
import { EmptyState } from '@/components/ui/empty-state'
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs'
import type { CourierOrderSummary } from '@/lib/courier/orders'

interface CourierBoardProps {
  /**
   * Whether the pool's orders can be taken: false for an admin, and for a
   * courier whose profile is not approved or whose papers expired.
   */
  canClaim: boolean
  /** An admin watching the pool, who never delivers. */
  supervising: boolean
  available: CourierOrderSummary[]
  active: CourierOrderSummary[]
  history: CourierOrderSummary[]
}

function Count({ value }: { value: number }) {
  if (value === 0) return null
  return (
    <Badge
      variant="secondary"
      className="rounded-pill h-4 min-w-4 px-1 text-[10px]"
    >
      {value}
    </Badge>
  )
}

export function CourierBoard({
  canClaim,
  supervising,
  available: initialAvailable,
  active,
  history,
}: CourierBoardProps) {
  // Online is client-only state: closing the tab stops sharing the position.
  const [online, setOnline] = useState(false)
  const publisher = useGeolocationPublisher(online)
  // The pool is reconciled client-side: an order another courier claimed stops
  // matching this courier's RLS predicate, so its disappearance never arrives
  // as an event.
  const available = useCourierPool(initialAvailable)

  return (
    <div className="space-y-6">
      {/* A courier who cannot claim right now may still be finishing a
          delivery, so the location switch stays theirs. */}
      {!supervising ? (
        <OnlineSwitch online={online} state={publisher} onChange={setOnline} />
      ) : (
        <p
          role="note"
          className="rounded-card border-border bg-muted/40 text-muted-foreground border p-4 text-sm"
        >
          Vista de supervisión: ves los pedidos disponibles, pero solo los
          domiciliarios pueden tomarlos.
        </p>
      )}

      <Tabs defaultValue={active.length > 0 ? 'entregas' : 'disponibles'}>
        <TabsList className="w-full sm:w-auto">
          <TabsTrigger value="disponibles">
            Disponibles <Count value={available.length} />
          </TabsTrigger>
          <TabsTrigger value="entregas">
            Mis entregas <Count value={active.length} />
          </TabsTrigger>
          <TabsTrigger value="historial">Historial</TabsTrigger>
        </TabsList>

        <TabsContent value="disponibles" className="pt-4">
          {available.length > 0 ? (
            <ul className="grid gap-3 sm:grid-cols-2">
              {available.map((order) => (
                <li key={order.id}>
                  <AvailableOrderCard order={order} canClaim={canClaim} />
                </li>
              ))}
            </ul>
          ) : (
            <EmptyState
              illustration="rider"
              title="No hay pedidos disponibles"
              description="Cuando un restaurante marque un domicilio como listo aparecerá aquí al instante."
              className="py-10"
            />
          )}
        </TabsContent>

        <TabsContent value="entregas" className="pt-4">
          {active.length > 0 ? (
            <ul className="grid gap-3 sm:grid-cols-2">
              {active.map((order) => (
                <li key={order.id}>
                  <DeliveryCard order={order} />
                </li>
              ))}
            </ul>
          ) : (
            <EmptyState
              illustration="rider"
              title="No tienes entregas en curso"
              description="Toma un pedido disponible para empezar."
              className="py-10"
            />
          )}
        </TabsContent>

        <TabsContent value="historial" className="pt-4">
          {history.length > 0 ? (
            <ul className="grid gap-3 sm:grid-cols-2">
              {history.map((order) => (
                <li key={order.id}>
                  <DeliveryCard order={order} compact />
                </li>
              ))}
            </ul>
          ) : (
            <EmptyState
              illustration="rider"
              title="Aún no hay entregas finalizadas"
              description="Tus entregas completadas y sus ganancias se listarán aquí."
              className="py-10"
            />
          )}
        </TabsContent>
      </Tabs>
    </div>
  )
}
