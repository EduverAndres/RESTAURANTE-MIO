'use client'

import { zodResolver } from '@hookform/resolvers/zod'
import {
  BikeIcon,
  CarIcon,
  FootprintsIcon,
  LoaderCircleIcon,
  type LucideIcon,
} from 'lucide-react'
import { useRouter } from 'next/navigation'
import { useTransition } from 'react'
import { Controller, useForm } from 'react-hook-form'
import { toast } from 'sonner'
import { saveCourierProfile } from '@/app/courier/actions'
import { FieldError } from '@/components/forms/field-error'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import {
  VEHICLE_LABELS,
  VEHICLE_TYPES,
  isMotorized,
  type VehicleType,
} from '@/lib/couriers/vocabulary'
import { cn } from '@/lib/utils'
import {
  courierProfileSchema,
  type CourierProfileInput,
  type CourierProfileValues,
} from '@/lib/validations/courier'

/** A motorbike has no icon of its own in lucide; the bike reads well enough. */
const VEHICLE_ICONS: Record<VehicleType, LucideIcon> = {
  motorcycle: BikeIcon,
  car: CarIcon,
  bicycle: BikeIcon,
  on_foot: FootprintsIcon,
}

export interface CourierProfileFormDefaults {
  vehicleType: VehicleType | ''
  plate: string
  documentNumber: string
  city: string
  zone: string
  licenseExpiresOn: string
  soatExpiresOn: string
}

/**
 * The courier's vehicle and papers. Plate, licence and SOAT only appear for a
 * motorbike or a car, which is also when the schema requires them.
 */
export function CourierProfileForm({
  defaults,
  approved,
}: {
  defaults: CourierProfileFormDefaults
  /** Whether the profile is approved today, to warn what sends it back. */
  approved: boolean
}) {
  const router = useRouter()
  const [pending, startTransition] = useTransition()

  const form = useForm<CourierProfileInput, unknown, CourierProfileValues>({
    resolver: zodResolver(courierProfileSchema),
    defaultValues: defaults as CourierProfileInput,
  })
  const vehicle = form.watch('vehicleType') as VehicleType | ''
  const motorized = vehicle !== '' && isMotorized(vehicle)
  const { errors, isDirty } = form.formState

  const onSubmit = form.handleSubmit(() => {
    // The action re-validates the raw shape, so send what the person typed.
    const input = form.getValues()
    startTransition(async () => {
      const result = await saveCourierProfile(input)
      if (!result.ok) {
        if (result.field) {
          form.setError(result.field as keyof CourierProfileInput, {
            message: result.error,
          })
        }
        toast.error(result.error)
        return
      }
      toast.success(
        result.status === 'approved'
          ? 'Perfil actualizado.'
          : result.status === 'pending'
            ? 'Perfil enviado. Te avisamos cuando lo revisemos.'
            : 'Perfil actualizado.',
      )
      form.reset(input)
      router.refresh()
    })
  })

  return (
    <form onSubmit={onSubmit} noValidate className="space-y-6">
      <fieldset className="space-y-2">
        <legend className="mb-2 text-sm font-medium">¿En qué repartes?</legend>
        <Controller
          control={form.control}
          name="vehicleType"
          render={({ field }) => (
            <div
              role="radiogroup"
              aria-describedby="vehicle-error"
              className="grid grid-cols-2 gap-2 sm:grid-cols-4"
            >
              {VEHICLE_TYPES.map((type) => {
                const Icon = VEHICLE_ICONS[type]
                const checked = field.value === type
                return (
                  <button
                    key={type}
                    type="button"
                    role="radio"
                    aria-checked={checked}
                    onClick={() => field.onChange(type)}
                    className={cn(
                      'rounded-control border-border flex h-14 items-center justify-center gap-2 border text-sm font-medium transition-colors',
                      checked
                        ? 'border-primary bg-primary/10 text-primary-on-tint'
                        : 'hover:bg-muted',
                    )}
                  >
                    <Icon aria-hidden="true" className="size-5" />
                    {VEHICLE_LABELS[type]}
                  </button>
                )
              })}
            </div>
          )}
        />
        <FieldError id="vehicle-error" message={errors.vehicleType?.message} />
      </fieldset>

      <div className="grid gap-4 sm:grid-cols-2">
        <div className="space-y-1.5">
          <Label htmlFor="courier-document">Número de documento</Label>
          <Input
            id="courier-document"
            inputMode="numeric"
            autoComplete="off"
            aria-invalid={Boolean(errors.documentNumber)}
            aria-describedby="courier-document-error"
            className="rounded-control h-11"
            {...form.register('documentNumber')}
          />
          <FieldError
            id="courier-document-error"
            message={errors.documentNumber?.message}
          />
        </div>
        <div className="space-y-1.5">
          <Label htmlFor="courier-city">Ciudad</Label>
          <Input
            id="courier-city"
            autoComplete="address-level2"
            aria-invalid={Boolean(errors.city)}
            aria-describedby="courier-city-error"
            className="rounded-control h-11"
            {...form.register('city')}
          />
          <FieldError id="courier-city-error" message={errors.city?.message} />
        </div>
        <div className="space-y-1.5 sm:col-span-2">
          <Label htmlFor="courier-zone">
            Zona donde prefieres repartir{' '}
            <span className="text-muted-foreground font-normal">
              (opcional)
            </span>
          </Label>
          <Input
            id="courier-zone"
            placeholder="Ej.: Norte, Riomar, Centro"
            aria-invalid={Boolean(errors.zone)}
            aria-describedby="courier-zone-error"
            className="rounded-control h-11"
            {...form.register('zone')}
          />
          <FieldError id="courier-zone-error" message={errors.zone?.message} />
        </div>
      </div>

      {motorized ? (
        <div className="grid gap-4 sm:grid-cols-3">
          <div className="space-y-1.5">
            <Label htmlFor="courier-plate">Placa</Label>
            <Input
              id="courier-plate"
              autoCapitalize="characters"
              placeholder="ABC12D"
              aria-invalid={Boolean(errors.plate)}
              aria-describedby="courier-plate-error"
              className="rounded-control h-11 uppercase"
              {...form.register('plate')}
            />
            <FieldError
              id="courier-plate-error"
              message={errors.plate?.message}
            />
          </div>
          <div className="space-y-1.5">
            <Label htmlFor="courier-license">Vence la licencia</Label>
            <Input
              id="courier-license"
              type="date"
              aria-invalid={Boolean(errors.licenseExpiresOn)}
              aria-describedby="courier-license-error"
              className="rounded-control h-11"
              {...form.register('licenseExpiresOn')}
            />
            <FieldError
              id="courier-license-error"
              message={errors.licenseExpiresOn?.message}
            />
          </div>
          <div className="space-y-1.5">
            <Label htmlFor="courier-soat">Vence el SOAT</Label>
            <Input
              id="courier-soat"
              type="date"
              aria-invalid={Boolean(errors.soatExpiresOn)}
              aria-describedby="courier-soat-error"
              className="rounded-control h-11"
              {...form.register('soatExpiresOn')}
            />
            <FieldError
              id="courier-soat-error"
              message={errors.soatExpiresOn?.message}
            />
          </div>
        </div>
      ) : null}

      {approved ? (
        <p className="text-muted-foreground text-sm">
          Renovar las fechas mantiene tu aprobación. Cambiar el vehículo, la
          placa o el documento envía tu perfil de nuevo a revisión.
        </p>
      ) : null}

      <Button
        type="submit"
        disabled={pending || !isDirty}
        className="rounded-pill h-11 px-6"
      >
        {pending ? (
          <LoaderCircleIcon aria-hidden="true" className="animate-spin" />
        ) : null}
        Guardar perfil
      </Button>
    </form>
  )
}
