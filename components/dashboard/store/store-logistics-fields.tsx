'use client'

import type { UseFormReturn } from 'react-hook-form'
import { FieldError } from '@/components/dashboard/store/field-error'
import { StoreLocationPicker } from '@/components/dashboard/store/store-location-picker'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { describedBy, errorId, hintId } from '@/lib/a11y/forms'
import { BOGOTA_CENTER, type LatLng } from '@/lib/geo'
import type { StoreLogisticsInput } from '@/lib/validations/store'

interface StoreLogisticsFieldsProps {
  /* eslint-disable-next-line @typescript-eslint/no-explicit-any */
  form: UseFormReturn<any>
  idPrefix?: string
}

interface NumberFieldProps {
  id: string
  label: string
  hint?: string
  step?: string
  min?: number
  error?: string
  registration: ReturnType<UseFormReturn<StoreLogisticsInput>['register']>
}

function NumberField({
  id,
  label,
  hint,
  step = '1',
  min = 0,
  error,
  registration,
}: NumberFieldProps) {
  return (
    <div className="space-y-1.5">
      <Label htmlFor={id}>{label}</Label>
      <Input
        id={id}
        type="number"
        inputMode="decimal"
        step={step}
        min={min}
        aria-invalid={Boolean(error)}
        // Only the ids that are actually on the page: pointing at
        // `${id}-error` unconditionally left every clean field describing
        // itself by an element that does not exist.
        aria-describedby={describedBy(
          Boolean(hint) && hintId(id),
          Boolean(error) && errorId(id),
        )}
        className="rounded-control h-11 tabular-nums"
        {...registration}
      />
      {hint ? (
        <p id={hintId(id)} className="text-muted-foreground text-xs">
          {hint}
        </p>
      ) : null}
      <FieldError id={errorId(id)} message={error} />
    </div>
  )
}

export function StoreLogisticsFields({
  form: untypedForm,
  idPrefix = 'store',
}: StoreLogisticsFieldsProps) {
  const form = untypedForm as UseFormReturn<StoreLogisticsInput>
  const { errors } = form.formState
  const lat = form.watch('lat')
  const lng = form.watch('lng')
  const pin: LatLng =
    typeof lat === 'number' && typeof lng === 'number' && !Number.isNaN(lat)
      ? { lat, lng }
      : BOGOTA_CENTER

  function setPin(point: LatLng) {
    form.setValue('lat', point.lat, { shouldValidate: true, shouldDirty: true })
    form.setValue('lng', point.lng, { shouldValidate: true, shouldDirty: true })
  }

  return (
    <div className="space-y-5">
      <div className="space-y-1.5">
        <Label htmlFor={`${idPrefix}-address`}>Dirección del local</Label>
        <Input
          id={`${idPrefix}-address`}
          autoComplete="street-address"
          placeholder="Carrera 6 # 119-40, Usaquén"
          aria-invalid={Boolean(errors.address)}
          aria-describedby={`${idPrefix}-address-error`}
          className="rounded-control h-11"
          {...form.register('address')}
        />
        <FieldError
          id={`${idPrefix}-address-error`}
          message={errors.address?.message}
        />
      </div>

      {/*
        `group` does not support aria-invalid, so the pin's error reaches the
        picker through aria-describedby alone — which is the part that was
        missing: the message rendered and nothing pointed at it.
      */}
      <div
        role="group"
        aria-label="Ubicación en el mapa"
        aria-describedby={describedBy(
          Boolean(errors.lat ?? errors.lng) && errorId(`${idPrefix}-pin`),
        )}
      >
        <StoreLocationPicker
          pin={pin}
          onPinChange={setPin}
          onAddressSuggested={(line1) => {
            if (!form.getValues('address')) {
              form.setValue('address', line1, {
                shouldValidate: true,
                shouldDirty: true,
              })
            }
          }}
        />
        <FieldError
          id={errorId(`${idPrefix}-pin`)}
          message={errors.lat?.message ?? errors.lng?.message}
        />
      </div>

      <div className="grid gap-4 sm:grid-cols-2">
        <NumberField
          id={`${idPrefix}-radius`}
          label="Radio de entrega (km)"
          step="0.5"
          min={0.5}
          error={errors.delivery_radius_km?.message}
          registration={form.register('delivery_radius_km', {
            valueAsNumber: true,
          })}
        />
        <NumberField
          id={`${idPrefix}-prep`}
          label="Tiempo de preparación (min)"
          min={1}
          error={errors.prep_time_min?.message}
          registration={form.register('prep_time_min', {
            valueAsNumber: true,
          })}
        />
        <NumberField
          id={`${idPrefix}-fee`}
          label="Costo de domicilio (COP)"
          step="100"
          hint="Se suma al pedido del cliente."
          error={errors.delivery_fee?.message}
          registration={form.register('delivery_fee', {
            valueAsNumber: true,
          })}
        />
        <NumberField
          id={`${idPrefix}-min-order`}
          label="Pedido mínimo (COP)"
          step="1000"
          hint="Deja 0 si no exiges mínimo."
          error={errors.min_order?.message}
          registration={form.register('min_order', { valueAsNumber: true })}
        />
      </div>
    </div>
  )
}
