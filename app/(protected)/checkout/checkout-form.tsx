'use client'

import {
  BanknoteIcon,
  CheckIcon,
  ChevronLeftIcon,
  ClockIcon,
  CreditCardIcon,
  LoaderCircleIcon,
  MapPinIcon,
  PlusIcon,
  ShoppingBagIcon,
  StoreIcon,
  TruckIcon,
} from 'lucide-react'
import Link from 'next/link'
import { useRouter } from 'next/navigation'
import { useEffect, useMemo, useState, useTransition } from 'react'
import { toast } from 'sonner'
import { getCheckoutStore, placeOrder, type CheckoutStore } from './actions'
import { AddressFormDialog } from '@/components/address/address-form'
import { Button } from '@/components/ui/button'
import { EmptyState } from '@/components/ui/empty-state'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { Skeleton } from '@/components/ui/skeleton'
import { Textarea } from '@/components/ui/textarea'
import { formatCOP } from '@/lib/format'
import { estimateEtaMinutes, haversineKm } from '@/lib/geo'
import type { PaymentOption } from '@/lib/payments'
import {
  TIP_PRESETS,
  computeLineTotal,
  computeOrderTotals,
  computeTip,
  meetsMinOrder,
} from '@/lib/pricing'
import { cn } from '@/lib/utils'
import type { CheckoutInput } from '@/lib/validations/checkout'
import { useCartStore } from '@/stores/cart.store'
import { usePreferencesStore } from '@/stores/preferences.store'
import type { Address, PaymentMethod } from '@/types/app'

interface CheckoutFormProps {
  addresses: Address[]
  paymentOptions: PaymentOption[]
}

type DeliveryType = 'delivery' | 'pickup'
type Step = 'entrega' | 'pago' | 'resumen'
const STEPS: { id: Step; label: string }[] = [
  { id: 'entrega', label: 'Entrega' },
  { id: 'pago', label: 'Pago' },
  { id: 'resumen', label: 'Resumen' },
]

const PAYMENT_ICONS: Partial<Record<PaymentMethod, React.ReactNode>> = {
  cash: <BanknoteIcon aria-hidden="true" className="size-5" />,
  mock: <CreditCardIcon aria-hidden="true" className="size-5" />,
  wompi: <CreditCardIcon aria-hidden="true" className="size-5" />,
  mercadopago: <CreditCardIcon aria-hidden="true" className="size-5" />,
}

function nextQuarterHour(offsetMinutes: number): string {
  const date = new Date(Date.now() + offsetMinutes * 60_000)
  date.setMinutes(Math.ceil(date.getMinutes() / 15) * 15, 0, 0)
  const pad = (value: number) => String(value).padStart(2, '0')
  return `${date.getFullYear()}-${pad(date.getMonth() + 1)}-${pad(date.getDate())}T${pad(date.getHours())}:${pad(date.getMinutes())}`
}

export function CheckoutForm({
  addresses: initialAddresses,
  paymentOptions,
}: CheckoutFormProps) {
  const router = useRouter()
  const cart = useCartStore()
  const preferences = usePreferencesStore()
  const [hydrated, setHydrated] = useState(false)
  const [store, setStore] = useState<CheckoutStore | null | 'loading'>(
    'loading',
  )
  const [addresses, setAddresses] = useState(initialAddresses)
  const [addressDialog, setAddressDialog] = useState(false)
  const [type, setType] = useState<DeliveryType>('delivery')
  const [addressId, setAddressId] = useState<string | null>(
    initialAddresses.find((address) => address.is_default)?.id ??
      initialAddresses[0]?.id ??
      null,
  )
  const [schedule, setSchedule] = useState<'asap' | 'scheduled'>('asap')
  const [scheduledAt, setScheduledAt] = useState(() => nextQuarterHour(45))
  const [paymentMethod, setPaymentMethod] = useState<PaymentMethod | null>(null)
  const [tipPercent, setTipPercent] = useState(0)
  const [notes, setNotes] = useState('')
  const [step, setStep] = useState<Step>('entrega')
  const [pending, startTransition] = useTransition()

  useEffect(() => setHydrated(true), [])

  // Remembered preferences make the second purchase a two-tap affair.
  useEffect(() => {
    if (!hydrated) return
    const remembered = preferences.paymentMethod
    const available = paymentOptions.some(
      (option) => option.method === remembered,
    )
    setPaymentMethod(
      available && remembered
        ? remembered
        : (paymentOptions[0]?.method ?? null),
    )
    setTipPercent(preferences.tipPercent)
    // Only on first hydration.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [hydrated])

  useEffect(() => {
    if (!hydrated) return
    if (!cart.storeId) {
      setStore(null)
      return
    }
    let cancelled = false
    getCheckoutStore(cart.storeId).then((result) => {
      if (!cancelled) setStore(result)
    })
    return () => {
      cancelled = true
    }
  }, [hydrated, cart.storeId])

  const selectedAddress =
    addresses.find((address) => address.id === addressId) ?? null

  const distanceKm = useMemo(() => {
    if (store === 'loading' || !store || !selectedAddress) return null
    if (
      store.lat === null ||
      store.lng === null ||
      selectedAddress.lat === null ||
      selectedAddress.lng === null
    )
      return null
    return haversineKm(
      { lat: store.lat, lng: store.lng },
      { lat: Number(selectedAddress.lat), lng: Number(selectedAddress.lng) },
    )
  }, [store, selectedAddress])

  const outOfRange =
    type === 'delivery' &&
    store !== 'loading' &&
    store !== null &&
    distanceKm !== null &&
    distanceKm > store.deliveryRadiusKm

  const subtotal = cart.items.reduce(
    (sum, item) => sum + computeLineTotal(item),
    0,
  )
  const tip = computeTip(subtotal, { kind: 'percent', value: tipPercent })
  const totals = computeOrderTotals({
    items: cart.items,
    type,
    deliveryFee: store !== 'loading' && store ? store.deliveryFee : 0,
    tip,
  })
  const minimumOk =
    store !== 'loading' && store
      ? meetsMinOrder(subtotal, store.minOrder)
      : true
  const eta =
    store !== 'loading' && store
      ? estimateEtaMinutes({
          distanceKm: distanceKm ?? 0,
          prepTimeMin: store.prepTimeMin,
          type,
        })
      : null

  function validateStep(target: Step): string | null {
    if (target === 'pago' || target === 'resumen') {
      if (type === 'delivery' && !addressId)
        return 'Selecciona una dirección de entrega.'
      if (outOfRange) return 'La dirección está fuera de la zona de entrega.'
    }
    if (target === 'resumen' && !paymentMethod)
      return 'Elige un método de pago.'
    return null
  }

  function goTo(target: Step) {
    const error = validateStep(target)
    if (error) {
      toast.error(error)
      return
    }
    setStep(target)
    window.scrollTo({ top: 0, behavior: 'smooth' })
  }

  function submit() {
    if (store === 'loading' || !store || !paymentMethod) return
    const error = validateStep('resumen')
    if (error) {
      toast.error(error)
      return
    }
    const payload: CheckoutInput = {
      storeId: store.id,
      type,
      addressId: type === 'delivery' ? addressId : null,
      schedule,
      scheduledAt:
        schedule === 'scheduled' ? new Date(scheduledAt).toISOString() : null,
      paymentMethod,
      tipPercent,
      notes,
      items: cart.items.map((item) => ({
        productId: item.productId,
        quantity: item.quantity,
        optionValueIds: item.optionValueIds,
        notes: item.notes,
      })),
    }
    startTransition(async () => {
      const result = await placeOrder(payload)
      if (!result.ok) {
        toast.error(result.error)
        if (result.field === 'addressId') setStep('entrega')
        if (result.field === 'paymentMethod') setStep('pago')
        return
      }
      preferences.setPaymentMethod(paymentMethod)
      preferences.setTipPercent(tipPercent)
      cart.clear()
      toast.success('¡Pedido enviado! El restaurante lo confirmará en breve.')
      if (result.redirectUrl) {
        // Gateway checkout page: a full navigation, not a client route.
        window.location.assign(result.redirectUrl)
        return
      }
      router.push(`/orders/${result.orderId}`)
    })
  }

  if (!hydrated || store === 'loading') {
    return (
      <div className="grid gap-6 lg:grid-cols-[1.4fr_1fr]">
        <Skeleton className="rounded-card h-96" />
        <Skeleton className="rounded-card h-72" />
      </div>
    )
  }

  if (cart.items.length === 0 || !store) {
    return (
      <EmptyState
        title="Tu carrito está vacío"
        description="Agrega productos de un restaurante para continuar con el pago."
        action={
          <Button asChild className="rounded-pill">
            <Link href="/#restaurantes">Explorar restaurantes</Link>
          </Button>
        }
      />
    )
  }

  const stepIndex = STEPS.findIndex((entry) => entry.id === step)
  const visible = (target: Step) =>
    step === target ? 'block' : 'hidden md:block'

  return (
    <>
      <nav aria-label="Pasos del pago" className="mb-6 md:hidden">
        <ol className="flex items-center gap-2">
          {STEPS.map((entry, index) => (
            <li key={entry.id} className="flex flex-1 items-center gap-2">
              <span
                aria-current={step === entry.id ? 'step' : undefined}
                className={cn(
                  'flex size-7 items-center justify-center rounded-full text-xs font-semibold',
                  index < stepIndex
                    ? 'bg-success text-success-foreground'
                    : index === stepIndex
                      ? 'bg-primary text-primary-foreground'
                      : 'bg-muted text-muted-foreground',
                )}
              >
                {index < stepIndex ? (
                  <CheckIcon className="size-3.5" />
                ) : (
                  index + 1
                )}
              </span>
              <span
                className={cn(
                  'text-xs font-medium',
                  index === stepIndex
                    ? 'text-foreground'
                    : 'text-muted-foreground',
                )}
              >
                {entry.label}
              </span>
              {index < STEPS.length - 1 ? (
                <span className="bg-border h-px flex-1" />
              ) : null}
            </li>
          ))}
        </ol>
      </nav>

      <div className="grid gap-6 lg:grid-cols-[1.4fr_1fr] lg:items-start">
        <div className="space-y-6">
          <section
            className={cn(
              'rounded-card border-border bg-card shadow-soft space-y-5 border p-5',
              visible('entrega'),
            )}
            aria-labelledby="entrega-title"
          >
            <h2
              id="entrega-title"
              className="font-display text-2xl font-semibold"
            >
              Entrega
            </h2>

            <div
              role="radiogroup"
              aria-label="Tipo de entrega"
              className="grid grid-cols-2 gap-2"
            >
              {(
                [
                  {
                    value: 'delivery',
                    label: 'A domicilio',
                    hint: `Domicilio ${formatCOP(store.deliveryFee)}`,
                    icon: TruckIcon,
                  },
                  {
                    value: 'pickup',
                    label: 'Recoger',
                    hint: 'Sin costo de envío',
                    icon: StoreIcon,
                  },
                ] as const
              ).map((option) => (
                <button
                  key={option.value}
                  type="button"
                  role="radio"
                  aria-checked={type === option.value}
                  onClick={() => setType(option.value)}
                  className={cn(
                    'rounded-card flex items-center gap-3 border p-3 text-left transition-colors',
                    type === option.value
                      ? 'border-primary bg-primary/6 ring-primary ring-1'
                      : 'border-border hover:border-foreground/30',
                  )}
                >
                  <option.icon
                    aria-hidden="true"
                    className="text-primary size-5"
                  />
                  <span>
                    <span className="block text-sm font-medium">
                      {option.label}
                    </span>
                    <span className="text-muted-foreground block text-xs">
                      {option.hint}
                    </span>
                  </span>
                </button>
              ))}
            </div>

            {type === 'delivery' ? (
              <div className="space-y-2">
                <div className="flex items-center justify-between">
                  <Label className="text-sm font-semibold">Dirección</Label>
                  <Button
                    type="button"
                    variant="ghost"
                    size="sm"
                    className="rounded-pill"
                    onClick={() => setAddressDialog(true)}
                  >
                    <PlusIcon aria-hidden="true" />
                    Nueva
                  </Button>
                </div>
                {addresses.length === 0 ? (
                  <button
                    type="button"
                    onClick={() => setAddressDialog(true)}
                    className="rounded-card border-border text-muted-foreground hover:border-primary hover:text-foreground flex w-full items-center gap-3 border border-dashed p-4 text-left text-sm"
                  >
                    <MapPinIcon
                      aria-hidden="true"
                      className="text-primary size-5"
                    />
                    Agrega tu primera dirección para continuar.
                  </button>
                ) : (
                  <div
                    role="radiogroup"
                    aria-label="Dirección de entrega"
                    className="grid gap-2"
                  >
                    {addresses.map((address) => {
                      const active = addressId === address.id
                      return (
                        <button
                          key={address.id}
                          type="button"
                          role="radio"
                          aria-checked={active}
                          onClick={() => setAddressId(address.id)}
                          className={cn(
                            'rounded-card flex items-start gap-3 border p-3 text-left transition-colors',
                            active
                              ? 'border-primary bg-primary/6 ring-primary ring-1'
                              : 'border-border hover:border-foreground/30',
                          )}
                        >
                          <MapPinIcon
                            aria-hidden="true"
                            className="text-primary mt-0.5 size-4"
                          />
                          <span className="min-w-0">
                            <span className="block text-sm font-medium">
                              {address.label ?? 'Dirección'}
                            </span>
                            <span className="text-muted-foreground block truncate text-xs">
                              {address.line1}
                              {address.line2 ? `, ${address.line2}` : ''}
                            </span>
                          </span>
                        </button>
                      )
                    })}
                  </div>
                )}
                {outOfRange ? (
                  <p role="alert" className="text-destructive text-xs">
                    Esta dirección está a {distanceKm?.toFixed(1)} km;{' '}
                    {store.name} entrega hasta {store.deliveryRadiusKm} km.
                  </p>
                ) : null}
              </div>
            ) : null}

            <div className="space-y-2">
              <Label className="text-sm font-semibold">¿Cuándo?</Label>
              <div
                role="radiogroup"
                aria-label="Hora de entrega"
                className="grid grid-cols-2 gap-2"
              >
                <button
                  type="button"
                  role="radio"
                  aria-checked={schedule === 'asap'}
                  onClick={() => setSchedule('asap')}
                  className={cn(
                    'rounded-card border p-3 text-left text-sm',
                    schedule === 'asap'
                      ? 'border-primary bg-primary/6 ring-primary ring-1'
                      : 'border-border',
                  )}
                >
                  <span className="block font-medium">Lo antes posible</span>
                  <span className="text-muted-foreground block text-xs">
                    {eta ? `Aprox. ${eta} min` : 'Según preparación'}
                  </span>
                </button>
                <button
                  type="button"
                  role="radio"
                  aria-checked={schedule === 'scheduled'}
                  onClick={() => setSchedule('scheduled')}
                  className={cn(
                    'rounded-card border p-3 text-left text-sm',
                    schedule === 'scheduled'
                      ? 'border-primary bg-primary/6 ring-primary ring-1'
                      : 'border-border',
                  )}
                >
                  <span className="block font-medium">Programar</span>
                  <span className="text-muted-foreground block text-xs">
                    Elige día y hora
                  </span>
                </button>
              </div>
              {schedule === 'scheduled' ? (
                <div className="flex items-center gap-2">
                  <ClockIcon
                    aria-hidden="true"
                    className="text-muted-foreground size-4"
                  />
                  <Input
                    type="datetime-local"
                    aria-label="Fecha y hora programada"
                    value={scheduledAt}
                    min={nextQuarterHour(15)}
                    onChange={(event) => setScheduledAt(event.target.value)}
                    className="rounded-control h-11"
                  />
                </div>
              ) : null}
            </div>

            <div className="flex justify-end md:hidden">
              <Button
                type="button"
                className="rounded-pill"
                onClick={() => goTo('pago')}
              >
                Continuar
              </Button>
            </div>
          </section>

          <section
            className={cn(
              'rounded-card border-border bg-card shadow-soft space-y-5 border p-5',
              visible('pago'),
            )}
            aria-labelledby="pago-title"
          >
            <h2 id="pago-title" className="font-display text-2xl font-semibold">
              Pago
            </h2>
            <div
              role="radiogroup"
              aria-label="Método de pago"
              className="grid gap-2"
            >
              {paymentOptions.map((option) => {
                const active = paymentMethod === option.method
                return (
                  <button
                    key={option.method}
                    type="button"
                    role="radio"
                    aria-checked={active}
                    onClick={() => setPaymentMethod(option.method)}
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

            <div className="space-y-2">
              <Label className="text-sm font-semibold">
                Propina para el domiciliario
              </Label>
              <div
                role="radiogroup"
                aria-label="Propina"
                className="grid grid-cols-4 gap-2"
              >
                {TIP_PRESETS.map((preset) => (
                  <button
                    key={preset}
                    type="button"
                    role="radio"
                    aria-checked={tipPercent === preset}
                    onClick={() => setTipPercent(preset)}
                    className={cn(
                      'rounded-control border py-2 text-sm font-medium',
                      tipPercent === preset
                        ? 'border-primary bg-primary text-primary-foreground'
                        : 'border-border hover:bg-muted',
                    )}
                  >
                    {preset === 0 ? 'Sin propina' : `${preset} %`}
                  </button>
                ))}
              </div>
              {tip > 0 ? (
                <p className="text-muted-foreground text-xs">
                  Agregas {formatCOP(tip)}. Va íntegra al domiciliario.
                </p>
              ) : null}
            </div>

            <div className="space-y-1.5">
              <Label htmlFor="order-notes" className="text-sm font-semibold">
                Notas para el restaurante
              </Label>
              <Textarea
                id="order-notes"
                value={notes}
                maxLength={300}
                onChange={(event) => setNotes(event.target.value)}
                placeholder="Timbre dañado, llamar al llegar…"
                className="rounded-control min-h-20"
              />
            </div>

            <div className="flex justify-between md:hidden">
              <Button
                type="button"
                variant="ghost"
                className="rounded-pill"
                onClick={() => goTo('entrega')}
              >
                <ChevronLeftIcon aria-hidden="true" />
                Atrás
              </Button>
              <Button
                type="button"
                className="rounded-pill"
                onClick={() => goTo('resumen')}
              >
                Revisar pedido
              </Button>
            </div>
          </section>
        </div>

        <aside
          className={cn(
            'rounded-card border-border bg-card shadow-soft space-y-4 border p-5 lg:sticky lg:top-24',
            visible('resumen'),
          )}
          aria-labelledby="resumen-title"
        >
          <div className="flex items-center gap-2">
            <ShoppingBagIcon
              aria-hidden="true"
              className="text-primary size-5"
            />
            <h2
              id="resumen-title"
              className="font-display text-2xl font-semibold"
            >
              Resumen
            </h2>
          </div>
          <p className="text-muted-foreground text-sm">
            Pedido a{' '}
            <Link
              href={`/t/${store.slug}`}
              className="text-foreground font-medium underline-offset-4 hover:underline"
            >
              {store.name}
            </Link>
          </p>
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
              <dd className="tabular-nums">{formatCOP(totals.subtotal)}</dd>
            </div>
            <div className="flex justify-between">
              <dt className="text-muted-foreground">Domicilio</dt>
              <dd className="tabular-nums">
                {type === 'delivery' ? formatCOP(totals.deliveryFee) : 'Gratis'}
              </dd>
            </div>
            <div className="flex justify-between">
              <dt className="text-muted-foreground">Propina</dt>
              <dd className="tabular-nums">{formatCOP(totals.tip)}</dd>
            </div>
            <div className="border-border flex justify-between border-t pt-2 text-base font-semibold">
              <dt>Total</dt>
              <dd className="tabular-nums">{formatCOP(totals.total)}</dd>
            </div>
          </dl>
          {!minimumOk ? (
            <p role="alert" className="text-destructive text-xs">
              El pedido mínimo de {store.name} es {formatCOP(store.minOrder)}.
            </p>
          ) : null}
          <Button
            type="button"
            onClick={submit}
            disabled={pending || !minimumOk || outOfRange}
            className="rounded-pill h-12 w-full text-base"
          >
            {pending ? (
              <LoaderCircleIcon aria-hidden="true" className="animate-spin" />
            ) : null}
            {paymentMethod === 'cash'
              ? 'Confirmar pedido'
              : `Pagar ${formatCOP(totals.total)}`}
          </Button>
          <p className="text-muted-foreground text-center text-xs">
            {eta ? `Tiempo estimado: ${eta} min.` : ''} Podrás cancelar mientras
            el restaurante no lo acepte.
          </p>
          <div className="md:hidden">
            <Button
              type="button"
              variant="ghost"
              className="rounded-pill w-full"
              onClick={() => goTo('pago')}
            >
              <ChevronLeftIcon aria-hidden="true" />
              Volver al pago
            </Button>
          </div>
        </aside>
      </div>

      <AddressFormDialog
        open={addressDialog}
        onOpenChange={setAddressDialog}
        onSaved={(address) => {
          setAddresses((current) => {
            const others = current.filter((entry) => entry.id !== address.id)
            const normalised = address.is_default
              ? others.map((entry) => ({ ...entry, is_default: false }))
              : others
            return [address, ...normalised]
          })
          setAddressId(address.id)
        }}
      />
    </>
  )
}
