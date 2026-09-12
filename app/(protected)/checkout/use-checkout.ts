'use client'

import { useRouter } from 'next/navigation'
import { useEffect, useMemo, useState, useTransition } from 'react'
import { toast } from 'sonner'
import { getCheckoutStore, placeOrder, type CheckoutStore } from './actions'
import {
  nextQuarterHour,
  type DeliveryType,
  type Schedule,
  type Step,
} from './steps'
import { markOrderJustPlaced } from '@/lib/orders/just-placed'
import { estimateEtaMinutes, haversineKm } from '@/lib/geo'
import type { PaymentOption } from '@/lib/payments'
import {
  computeLineTotal,
  computeOrderTotals,
  computeTip,
  meetsMinOrder,
} from '@/lib/pricing'
import type { CheckoutInput } from '@/lib/validations/checkout'
import { useCartStore } from '@/stores/cart.store'
import { usePreferencesStore } from '@/stores/preferences.store'
import type { Address, PaymentMethod } from '@/types/app'

interface UseCheckoutOptions {
  addresses: Address[]
  paymentOptions: PaymentOption[]
}

/**
 * Every piece of checkout state, and the one action that spends it.
 *
 * It lives apart from the markup because the markup is now four panels that
 * all read the same object: pulling the state up here is what let the 790-line
 * form become a set of presentational pieces instead of one file nobody
 * wanted to restyle.
 */
export function useCheckout({
  addresses: initialAddresses,
  paymentOptions,
}: UseCheckoutOptions) {
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
  const [schedule, setSchedule] = useState<Schedule>('asap')
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
  const resolvedStore = store === 'loading' ? null : store

  const distanceKm = useMemo(() => {
    if (!resolvedStore || !selectedAddress) return null
    if (
      resolvedStore.lat === null ||
      resolvedStore.lng === null ||
      selectedAddress.lat === null ||
      selectedAddress.lng === null
    )
      return null
    return haversineKm(
      { lat: resolvedStore.lat, lng: resolvedStore.lng },
      { lat: Number(selectedAddress.lat), lng: Number(selectedAddress.lng) },
    )
  }, [resolvedStore, selectedAddress])

  const outOfRange =
    type === 'delivery' &&
    resolvedStore !== null &&
    distanceKm !== null &&
    distanceKm > resolvedStore.deliveryRadiusKm

  const subtotal = cart.items.reduce(
    (sum, item) => sum + computeLineTotal(item),
    0,
  )
  const tip = computeTip(subtotal, { kind: 'percent', value: tipPercent })
  const totals = computeOrderTotals({
    items: cart.items,
    type,
    deliveryFee: resolvedStore ? resolvedStore.deliveryFee : 0,
    tip,
  })
  const minimumOk = resolvedStore
    ? meetsMinOrder(subtotal, resolvedStore.minOrder)
    : true
  const eta = resolvedStore
    ? estimateEtaMinutes({
        distanceKm: distanceKm ?? 0,
        prepTimeMin: resolvedStore.prepTimeMin,
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
    if (!resolvedStore || !paymentMethod) return
    const error = validateStep('resumen')
    if (error) {
      toast.error(error)
      return
    }
    const payload: CheckoutInput = {
      storeId: resolvedStore.id,
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
      // The tracking page plays the confirmation; this is the handoff.
      markOrderJustPlaced(result.orderId)
      router.push(`/orders/${result.orderId}`)
    })
  }

  function addAddress(address: Address) {
    setAddresses((current) => {
      const others = current.filter((entry) => entry.id !== address.id)
      const normalised = address.is_default
        ? others.map((entry) => ({ ...entry, is_default: false }))
        : others
      return [address, ...normalised]
    })
    setAddressId(address.id)
  }

  return {
    // lifecycle
    ready: hydrated && store !== 'loading',
    store: resolvedStore,
    cart,
    pending,
    // step machine
    step,
    goTo,
    // delivery
    type,
    setType,
    addresses,
    addressId,
    setAddressId,
    addressDialog,
    setAddressDialog,
    addAddress,
    schedule,
    setSchedule,
    scheduledAt,
    setScheduledAt,
    distanceKm,
    outOfRange,
    eta,
    // payment
    paymentOptions,
    paymentMethod,
    setPaymentMethod,
    tipPercent,
    setTipPercent,
    tip,
    notes,
    setNotes,
    // money
    totals,
    minimumOk,
    submit,
  }
}

export type CheckoutController = ReturnType<typeof useCheckout>
