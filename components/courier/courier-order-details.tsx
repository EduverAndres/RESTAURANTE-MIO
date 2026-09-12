import {
  BanknoteIcon,
  MapPinIcon,
  MessageCircleIcon,
  PhoneIcon,
  StickyNoteIcon,
  StoreIcon,
} from 'lucide-react'
import { Button } from '@/components/ui/button'
import { formatCOP } from '@/lib/format'
import { buildWhatsAppUrl, normalizePhone } from '@/lib/orders/whatsapp'
import type { OrderItemOption, PaymentMethod, PaymentStatus } from '@/types/app'

export interface CourierOrderItem {
  id: string
  name_snapshot: string
  quantity: number
  options: unknown
}

interface CourierOrderDetailsProps {
  shortCode: string
  storeName: string
  storeAddress: string | null
  storeWhatsApp: string | null
  customerName: string | null
  customerPhone: string | null
  addressLine: string | null
  addressLabel: string | null
  items: CourierOrderItem[]
  notes: string | null
  total: number
  paymentMethod: PaymentMethod
  paymentStatus: PaymentStatus
}

function optionsOf(value: unknown): OrderItemOption[] {
  return Array.isArray(value) ? (value as OrderItemOption[]) : []
}

/** Presentational block: who to call, where to go and what to hand over. */
export function CourierOrderDetails({
  shortCode,
  storeName,
  storeAddress,
  storeWhatsApp,
  customerName,
  customerPhone,
  addressLine,
  addressLabel,
  items,
  notes,
  total,
  paymentMethod,
  paymentStatus,
}: CourierOrderDetailsProps) {
  const tel = normalizePhone(customerPhone)
  const whatsapp = buildWhatsAppUrl(
    storeWhatsApp,
    `Hola, soy el domiciliario del pedido #${shortCode}.`,
  )
  const collectCash = paymentMethod === 'cash' && paymentStatus !== 'paid'

  return (
    <div className="space-y-5">
      {collectCash ? (
        <p className="rounded-card bg-accent/20 flex items-center gap-2 p-4 text-sm font-medium text-amber-900 dark:text-amber-200">
          <BanknoteIcon aria-hidden="true" className="size-5 shrink-0" />
          Cobrar en efectivo al entregar: {formatCOP(total)}
        </p>
      ) : null}

      <section className="space-y-2">
        <h2 className="font-display text-xl font-semibold">Entregar a</h2>
        <p className="text-sm font-medium">{customerName ?? 'Cliente'}</p>
        <p className="flex items-start gap-2 text-sm">
          <MapPinIcon
            aria-hidden="true"
            className="text-primary mt-0.5 size-4 shrink-0"
          />
          <span>
            {addressLabel ? (
              <span className="block font-medium">{addressLabel}</span>
            ) : null}
            <span className="text-muted-foreground block">
              {addressLine ?? 'Dirección no disponible'}
            </span>
          </span>
        </p>
        {tel ? (
          <Button asChild variant="outline" className="rounded-pill">
            <a href={`tel:+${tel}`}>
              <PhoneIcon aria-hidden="true" />
              Llamar al cliente
            </a>
          </Button>
        ) : null}
      </section>

      <section className="space-y-2">
        <h2 className="font-display text-xl font-semibold">Recoger en</h2>
        <p className="flex items-start gap-2 text-sm">
          <StoreIcon
            aria-hidden="true"
            className="text-primary mt-0.5 size-4 shrink-0"
          />
          <span>
            <span className="block font-medium">{storeName}</span>
            <span className="text-muted-foreground block">
              {storeAddress ?? 'Dirección no disponible'}
            </span>
          </span>
        </p>
        {whatsapp ? (
          <Button
            asChild
            variant="outline"
            className="rounded-pill text-[#128C7E]"
          >
            <a href={whatsapp} target="_blank" rel="noopener noreferrer">
              <MessageCircleIcon aria-hidden="true" />
              Escribir al restaurante
            </a>
          </Button>
        ) : null}
      </section>

      <section className="space-y-2">
        <h2 className="font-display text-xl font-semibold">Pedido</h2>
        <ul className="divide-border divide-y text-sm">
          {items.map((item) => {
            const options = optionsOf(item.options)
            return (
              <li key={item.id} className="py-2">
                <span className="block">
                  {item.quantity}× {item.name_snapshot}
                </span>
                {options.length > 0 ? (
                  <span className="text-muted-foreground block text-xs">
                    {options.map((option) => option.value).join(', ')}
                  </span>
                ) : null}
              </li>
            )
          })}
        </ul>
        {notes ? (
          <p className="rounded-control bg-muted/60 flex items-start gap-2 p-3 text-sm">
            <StickyNoteIcon
              aria-hidden="true"
              className="mt-0.5 size-4 shrink-0"
            />
            <span>{notes}</span>
          </p>
        ) : null}
      </section>
    </div>
  )
}
