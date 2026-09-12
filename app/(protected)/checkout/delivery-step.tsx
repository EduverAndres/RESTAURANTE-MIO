'use client'

import {
  ClockIcon,
  MapPinIcon,
  PlusIcon,
  StoreIcon,
  TruckIcon,
} from 'lucide-react'
import { OptionCard } from './option-card'
import { nextQuarterHour } from './steps'
import type { CheckoutController } from './use-checkout'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { formatCOP } from '@/lib/format'
import { cn } from '@/lib/utils'

function IconTile({ children }: { children: React.ReactNode }) {
  return (
    <span
      aria-hidden="true"
      className="rounded-control bg-primary/10 text-primary-on-tint grid size-10 shrink-0 place-items-center"
    >
      {children}
    </span>
  )
}

export function DeliveryStep({
  checkout,
  className,
}: {
  checkout: CheckoutController
  className?: string
}) {
  const { store } = checkout
  if (!store) return null

  return (
    <section
      className={cn(
        'rounded-card border-border bg-card shadow-1 p-card space-y-5 border',
        className,
      )}
      aria-labelledby="entrega-title"
    >
      <h2 id="entrega-title" className="text-h3 font-display font-semibold">
        Entrega
      </h2>

      <div
        role="radiogroup"
        aria-label="Tipo de entrega"
        className="grid gap-2 sm:grid-cols-2"
      >
        <OptionCard
          checked={checkout.type === 'delivery'}
          onSelect={() => checkout.setType('delivery')}
          leading={
            <IconTile>
              <TruckIcon className="size-5" />
            </IconTile>
          }
          title="A domicilio"
          hint={`Domicilio ${formatCOP(store.deliveryFee)}`}
        />
        <OptionCard
          checked={checkout.type === 'pickup'}
          onSelect={() => checkout.setType('pickup')}
          leading={
            <IconTile>
              <StoreIcon className="size-5" />
            </IconTile>
          }
          title="Recoger"
          hint="Sin costo de envío"
        />
      </div>

      {checkout.type === 'delivery' ? (
        <div className="space-y-2">
          <div className="flex items-center justify-between">
            {/*
              The visible heading IS the group's name (WCAG 2.5.3), so the
              radiogroup points at it instead of carrying a different
              `aria-label` that a voice-control user could never guess from
              what is on screen.
            */}
            <Label
              id="checkout-address-label"
              className="text-sm font-semibold"
            >
              Dirección
            </Label>
            <Button
              type="button"
              variant="ghost"
              size="sm"
              className="rounded-pill"
              onClick={() => checkout.setAddressDialog(true)}
            >
              <PlusIcon aria-hidden="true" />
              Nueva
            </Button>
          </div>
          {checkout.addresses.length === 0 ? (
            <button
              type="button"
              onClick={() => checkout.setAddressDialog(true)}
              className="rounded-card border-border text-muted-foreground hover:border-primary hover:text-foreground flex min-h-14 w-full items-center gap-3 border border-dashed p-4 text-left text-sm"
            >
              <MapPinIcon aria-hidden="true" className="text-primary size-5" />
              Agrega tu primera dirección para continuar.
            </button>
          ) : (
            <div
              role="radiogroup"
              aria-labelledby="checkout-address-label"
              className="grid gap-2"
            >
              {checkout.addresses.map((address) => (
                <OptionCard
                  key={address.id}
                  checked={checkout.addressId === address.id}
                  onSelect={() => checkout.setAddressId(address.id)}
                  leading={
                    <MapPinIcon
                      aria-hidden="true"
                      className="text-primary size-5 shrink-0"
                    />
                  }
                  title={address.label ?? 'Dirección'}
                  hint={
                    <span className="block truncate">
                      {address.line1}
                      {address.line2 ? `, ${address.line2}` : ''}
                    </span>
                  }
                />
              ))}
            </div>
          )}
          {checkout.outOfRange ? (
            <p role="alert" className="text-destructive text-xs">
              Esta dirección está a {checkout.distanceKm?.toFixed(1)} km;{' '}
              {store.name} entrega hasta {store.deliveryRadiusKm} km.
            </p>
          ) : null}
        </div>
      ) : null}

      <div className="space-y-2">
        <Label id="checkout-schedule-label" className="text-sm font-semibold">
          ¿Cuándo?
        </Label>
        <div
          role="radiogroup"
          aria-labelledby="checkout-schedule-label"
          className="grid gap-2 sm:grid-cols-2"
        >
          <OptionCard
            checked={checkout.schedule === 'asap'}
            onSelect={() => checkout.setSchedule('asap')}
            title="Lo antes posible"
            hint={
              checkout.eta ? `Aprox. ${checkout.eta} min` : 'Según preparación'
            }
          />
          <OptionCard
            checked={checkout.schedule === 'scheduled'}
            onSelect={() => checkout.setSchedule('scheduled')}
            title="Programar"
            hint="Elige día y hora"
          />
        </div>
        {checkout.schedule === 'scheduled' ? (
          <div className="space-y-1.5 pt-1">
            <Label htmlFor="checkout-scheduled-at">
              Fecha y hora de entrega
            </Label>
            <div className="flex items-center gap-2">
              <ClockIcon
                aria-hidden="true"
                className="text-muted-foreground size-4"
              />
              <Input
                id="checkout-scheduled-at"
                type="datetime-local"
                value={checkout.scheduledAt}
                min={nextQuarterHour(15)}
                onChange={(event) =>
                  checkout.setScheduledAt(event.target.value)
                }
                className="rounded-control h-11"
              />
            </div>
          </div>
        ) : null}
      </div>

      <div className="flex justify-end md:hidden">
        <Button
          type="button"
          className="rounded-pill h-12 px-6 text-base"
          onClick={() => checkout.goTo('pago')}
        >
          Continuar
        </Button>
      </div>
    </section>
  )
}
