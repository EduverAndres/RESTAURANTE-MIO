'use client'

import {
  BanknoteIcon,
  CreditCardIcon,
  LoaderCircleIcon,
  ShoppingBagIcon,
} from 'lucide-react'
import Link from 'next/link'
import { useRouter } from 'next/navigation'
import { useEffect, useState, useTransition } from 'react'
import { toast } from 'sonner'
import { placeTableOrder } from '../actions'
import { Button } from '@/components/ui/button'
import { EmptyState } from '@/components/ui/empty-state'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { Skeleton } from '@/components/ui/skeleton'
import { Textarea } from '@/components/ui/textarea'
import type { CartTable } from '@/lib/cart'
import { formatCOP } from '@/lib/format'
import { estimateEtaMinutes } from '@/lib/geo'
import type { PaymentOption } from '@/lib/payments'
import { computeLineTotal, meetsMinOrder } from '@/lib/pricing'
import { tableEntryPath, tableOrderPath } from '@/lib/tables/qr'
import { cn } from '@/lib/utils'
import {
  TABLE_PAYMENT_METHODS,
  type TableOrderInput,
  type TablePaymentMethod,
} from '@/lib/validations/table-order'
import { useCartStore } from '@/stores/cart.store'

interface TableCheckoutStore {
  id: string
  slug: string
  name: string
  isOpen: boolean
  minOrder: number
  prepTimeMin: number
}

interface TableCheckoutFormProps {
  store: TableCheckoutStore
  table: CartTable
  paymentOptions: PaymentOption[]
  defaultGuestName: string
}

const PAYMENT_ICONS: Record<TablePaymentMethod, React.ReactNode> = {
  cash: <BanknoteIcon aria-hidden="true" className="size-5" />,
  mock: <CreditCardIcon aria-hidden="true" className="size-5" />,
  wompi: <CreditCardIcon aria-hidden="true" className="size-5" />,
}

function isTablePayment(value: string): value is TablePaymentMethod {
  return (TABLE_PAYMENT_METHODS as readonly string[]).includes(value)
}

export function TableCheckoutForm({
  store,
  table,
  paymentOptions,
  defaultGuestName,
}: TableCheckoutFormProps) {
  const router = useRouter()
  const cart = useCartStore()
  const [hydrated, setHydrated] = useState(false)
  const [guestName, setGuestName] = useState(defaultGuestName)
  const [notes, setNotes] = useState('')
  const [paymentMethod, setPaymentMethod] = useState<TablePaymentMethod | null>(
    () => {
      const first = paymentOptions[0]?.method
      return first && isTablePayment(first) ? first : null
    },
  )
  const [pending, startTransition] = useTransition()

  useEffect(() => setHydrated(true), [])

  const entryPath = tableEntryPath(store.slug, table.token)
  const sameStore = cart.storeId === store.id
  const subtotal = cart.items.reduce(
    (sum, item) => sum + computeLineTotal(item),
    0,
  )
  const minimumOk = meetsMinOrder(subtotal, store.minOrder)
  const eta = estimateEtaMinutes({
    distanceKm: 0,
    prepTimeMin: store.prepTimeMin,
    type: 'table',
  })

  function submit() {
    if (!paymentMethod) {
      toast.error('Elige cómo quieres pagar.')
      return
    }
    if (guestName.trim().length < 2) {
      toast.error('Dinos tu nombre (mínimo 2 letras).')
      return
    }
    const payload: TableOrderInput = {
      guestName,
      notes,
      paymentMethod,
      items: cart.items.map((item) => ({
        productId: item.productId,
        quantity: item.quantity,
        optionValueIds: item.optionValueIds,
        notes: item.notes,
      })),
    }
    startTransition(async () => {
      const result = await placeTableOrder(
        { slug: store.slug, token: table.token },
        payload,
      )
      if (!result.ok) {
        toast.error(result.error)
        return
      }
      cart.clear()
      toast.success('¡Pedido enviado! En un momento lo llevamos a tu mesa.')
      if (result.redirectUrl) {
        // Gateway checkout page: a full navigation, not a client route.
        window.location.assign(result.redirectUrl)
        return
      }
      router.push(tableOrderPath(store.slug, table.token, result.orderId))
    })
  }

  if (!hydrated) {
    return (
      <div className="space-y-6">
        <Skeleton className="rounded-card h-64" />
        <Skeleton className="rounded-card h-48" />
      </div>
    )
  }

  if (!sameStore || cart.items.length === 0) {
    return (
      <EmptyState
        title="Tu carrito está vacío"
        description={`Agrega platos del menú de ${store.name} para pedir desde la mesa ${table.number}.`}
        action={
          <Button asChild className="rounded-pill">
            <Link href={entryPath}>Ver el menú</Link>
          </Button>
        }
      />
    )
  }

  return (
    <div className="space-y-6">
      <section
        className="rounded-card border-border bg-card shadow-soft space-y-5 border p-5"
        aria-labelledby="datos-title"
      >
        <h2 id="datos-title" className="font-display text-2xl font-semibold">
          Tus datos
        </h2>
        <div className="space-y-1.5">
          <Label htmlFor="guest-name" className="text-sm font-semibold">
            Tu nombre
          </Label>
          <Input
            id="guest-name"
            value={guestName}
            maxLength={60}
            autoComplete="name"
            placeholder="Para saber a quién llevar el pedido"
            onChange={(event) => setGuestName(event.target.value)}
            className="rounded-control h-11"
          />
        </div>
        <div className="space-y-1.5">
          <Label htmlFor="table-notes" className="text-sm font-semibold">
            Notas para la cocina
          </Label>
          <Textarea
            id="table-notes"
            value={notes}
            maxLength={300}
            onChange={(event) => setNotes(event.target.value)}
            placeholder="Sin cebolla, alergias, cubiertos extra…"
            className="rounded-control min-h-20"
          />
        </div>
        <div className="space-y-2">
          <Label className="text-sm font-semibold">¿Cómo pagas?</Label>
          <div
            role="radiogroup"
            aria-label="Método de pago"
            className="grid gap-2"
          >
            {paymentOptions.map((option) => {
              if (!isTablePayment(option.method)) return null
              const active = paymentMethod === option.method
              return (
                <button
                  key={option.method}
                  type="button"
                  role="radio"
                  aria-checked={active}
                  onClick={() =>
                    setPaymentMethod(option.method as TablePaymentMethod)
                  }
                  className={cn(
                    'rounded-card flex items-center gap-3 border p-3 text-left transition-colors',
                    active
                      ? 'border-primary bg-primary/6 ring-primary ring-1'
                      : 'border-border hover:border-foreground/30',
                  )}
                >
                  <span className="rounded-control bg-muted text-primary flex size-10 items-center justify-center">
                    {PAYMENT_ICONS[option.method]}
                  </span>
                  <span>
                    <span className="block text-sm font-medium">
                      {option.label}
                    </span>
                    <span className="text-muted-foreground block text-xs">
                      {option.description}
                    </span>
                  </span>
                </button>
              )
            })}
          </div>
        </div>
      </section>

      <aside
        className="rounded-card border-border bg-card shadow-soft space-y-4 border p-5"
        aria-labelledby="resumen-title"
      >
        <div className="flex items-center gap-2">
          <ShoppingBagIcon aria-hidden="true" className="text-primary size-5" />
          <h2
            id="resumen-title"
            className="font-display text-2xl font-semibold"
          >
            Tu pedido
          </h2>
        </div>
        <ul className="divide-border divide-y">
          {cart.items.map((item) => (
            <li
              key={item.key}
              className="flex justify-between gap-3 py-2 text-sm"
            >
              <span className="min-w-0">
                <span className="block truncate">
                  {item.quantity}× {item.name}
                </span>
                {item.options.length > 0 ? (
                  <span className="text-muted-foreground block truncate text-xs">
                    {item.options.map((option) => option.value).join(', ')}
                  </span>
                ) : null}
              </span>
              <span className="tabular-nums">
                {formatCOP(computeLineTotal(item))}
              </span>
            </li>
          ))}
        </ul>
        <dl className="space-y-1.5 text-sm">
          <div className="flex justify-between">
            <dt className="text-muted-foreground">Subtotal</dt>
            <dd className="tabular-nums">{formatCOP(subtotal)}</dd>
          </div>
          <div className="border-border flex justify-between border-t pt-2 text-base font-semibold">
            <dt>Total</dt>
            <dd className="tabular-nums">{formatCOP(subtotal)}</dd>
          </div>
        </dl>
        {!minimumOk ? (
          <p role="alert" className="text-destructive text-xs">
            El pedido mínimo de {store.name} es {formatCOP(store.minOrder)}.
          </p>
        ) : null}
        {!store.isOpen ? (
          <p role="alert" className="text-destructive text-xs">
            El restaurante está cerrado en este momento.
          </p>
        ) : null}
        <Button
          type="button"
          onClick={submit}
          disabled={pending || !minimumOk || !store.isOpen}
          data-table-primary=""
          className="rounded-pill h-12 w-full text-base"
        >
          {pending ? (
            <LoaderCircleIcon aria-hidden="true" className="animate-spin" />
          ) : null}
          {paymentMethod === 'mock' || paymentMethod === 'wompi'
            ? `Pagar ${formatCOP(subtotal)}`
            : 'Confirmar pedido'}
        </Button>
        <p className="text-muted-foreground text-center text-xs">
          Listo en aprox. {eta} min. Lo llevamos a la mesa {table.number}.
        </p>
        <Button asChild variant="ghost" className="rounded-pill w-full">
          <Link href={entryPath}>Seguir pidiendo</Link>
        </Button>
      </aside>
    </div>
  )
}
