'use client'

import { useState } from 'react'
import { AvailableOrderCard } from '@/components/courier/available-order-card'
import { DeliveryCard } from '@/components/courier/delivery-card'
import { OnlineSwitch } from '@/components/courier/online-switch'
import { useCourierRealtime } from '@/components/courier/use-courier-realtime'
import { useGeolocationPublisher } from '@/components/courier/use-geolocation-publisher'
import { Badge } from '@/components/ui/badge'
import { EmptyState } from '@/components/ui/empty-state'
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs'
import type { CourierOrderSummary } from '@/lib/courier/orders'

interface CourierBoardProps {
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
  available,
  active,
  history,
}: CourierBoardProps) {
  // Online is client-only state: closing the tab stops sharing the position.
  const [online, setOnline] = useState(false)
  const publisher = useGeolocationPublisher(online)
  useCourierRealtime()

  return (
    <div className="space-y-6">
      <OnlineSwitch online={online} state={publisher} onChange={setOnline} />

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
                  <AvailableOrderCard order={order} />
                </li>
              ))}
            </ul>
          ) : (
            <EmptyState
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
