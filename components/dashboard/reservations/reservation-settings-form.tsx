'use client'

import { LoaderCircleIcon, SettingsIcon, XIcon } from 'lucide-react'
import { useRouter } from 'next/navigation'
import { useState, useTransition } from 'react'
import { toast } from 'sonner'
import { saveReservationSettings } from '@/app/dashboard/reservas/actions'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import {
  Sheet,
  SheetContent,
  SheetDescription,
  SheetHeader,
  SheetTitle,
  SheetTrigger,
} from '@/components/ui/sheet'
import { Switch } from '@/components/ui/switch'
import { Textarea } from '@/components/ui/textarea'
import { formatReservationLongDay } from '@/lib/reservations/format'
import type { ReservationSettingsValues } from '@/lib/validations/reservations'

const LEAD_OPTIONS = [
  { value: 0, label: 'Sin anticipación' },
  { value: 60, label: '1 hora' },
  { value: 120, label: '2 horas' },
  { value: 240, label: '4 horas' },
  { value: 1440, label: '1 día' },
]

function NumberField({
  id,
  label,
  hint,
  value,
  onChange,
  min,
  max,
}: {
  id: string
  label: string
  hint?: string
  value: number
  onChange: (value: number) => void
  min: number
  max: number
}) {
  return (
    <div className="space-y-1.5">
      <Label htmlFor={id}>{label}</Label>
      <Input
        id={id}
        type="number"
        inputMode="numeric"
        min={min}
        max={max}
        value={value}
        onChange={(event) => onChange(Number(event.target.value))}
        className="rounded-control h-11"
        aria-describedby={hint ? `${id}-hint` : undefined}
      />
      {hint ? (
        <p id={`${id}-hint`} className="text-muted-foreground text-xs">
          {hint}
        </p>
      ) : null}
    </div>
  )
}

/**
 * How the store takes reservations: on/off, the slot grid, capacity, notice,
 * horizon, policy and closed dates. In a side sheet so the board stays in
 * view; opened inline the first time, when nothing is set yet.
 */
export function ReservationSettingsForm({
  initial,
  included,
  defaultOpen = false,
}: {
  initial: ReservationSettingsValues
  included: boolean
  defaultOpen?: boolean
}) {
  const router = useRouter()
  const [open, setOpen] = useState(defaultOpen)
  const [values, setValues] = useState(initial)
  const [newDate, setNewDate] = useState('')
  const [pending, startTransition] = useTransition()
  const set = <K extends keyof ReservationSettingsValues>(
    key: K,
    value: ReservationSettingsValues[K],
  ) => setValues((current) => ({ ...current, [key]: value }))

  const save = () => {
    startTransition(async () => {
      const result = await saveReservationSettings(values)
      if (!result.ok) {
        toast.error(result.error)
        return
      }
      toast.success(
        values.enabled
          ? 'Listo: tus clientes ya pueden reservar.'
          : 'Configuración guardada. Las reservas están apagadas.',
      )
      setOpen(false)
      router.refresh()
    })
  }

  return (
    <Sheet open={open} onOpenChange={setOpen}>
      <SheetTrigger asChild>
        <Button variant="outline" className="rounded-pill">
          <SettingsIcon aria-hidden="true" data-icon="inline-start" />
          Configurar reservas
        </Button>
      </SheetTrigger>
      <SheetContent className="w-full overflow-y-auto sm:max-w-md">
        <SheetHeader>
          <SheetTitle>Configurar reservas</SheetTitle>
          <SheetDescription>
            Las horas se ofrecen dentro de tu horario de atención.
          </SheetDescription>
        </SheetHeader>

        <div className="space-y-5 px-4 pb-6">
          <div className="rounded-control border-border flex items-center justify-between gap-3 border p-3">
            <Label htmlFor="resv-enabled" className="flex-1">
              Recibir reservas
              <span className="text-muted-foreground block text-xs font-normal">
                {included
                  ? 'El botón "Reservar mesa" aparece en tu tienda.'
                  : 'Disponible en los planes Mediano y VIP.'}
              </span>
            </Label>
            <Switch
              id="resv-enabled"
              checked={values.enabled}
              disabled={!included && !values.enabled}
              onCheckedChange={(checked) => set('enabled', checked)}
            />
          </div>

          <div className="space-y-1.5">
            <Label htmlFor="resv-slot">Cada cuánto ofreces una hora</Label>
            <div id="resv-slot" role="radiogroup" className="flex gap-2">
              {[15, 30, 60].map((minutes) => (
                <button
                  key={minutes}
                  type="button"
                  role="radio"
                  aria-checked={values.slotMinutes === minutes}
                  onClick={() => set('slotMinutes', minutes)}
                  className={
                    values.slotMinutes === minutes
                      ? 'rounded-pill border-primary bg-primary/10 text-primary-on-tint h-10 flex-1 border text-sm font-medium'
                      : 'rounded-pill border-border hover:bg-muted h-10 flex-1 border text-sm'
                  }
                >
                  {minutes} min
                </button>
              ))}
            </div>
          </div>

          <div className="grid grid-cols-2 gap-4">
            <NumberField
              id="resv-covers"
              label="Personas por franja"
              hint="Cuántos pueden llegar en cada franja."
              value={values.coversPerSlot}
              onChange={(value) => set('coversPerSlot', value)}
              min={1}
              max={500}
            />
            <NumberField
              id="resv-party"
              label="Grupo máximo"
              value={values.maxPartySize}
              onChange={(value) => set('maxPartySize', value)}
              min={1}
              max={50}
            />
            <NumberField
              id="resv-duration"
              label="Duración (min)"
              hint="Cuánto dura una visita."
              value={values.durationMinutes}
              onChange={(value) => set('durationMinutes', value)}
              min={30}
              max={360}
            />
            <NumberField
              id="resv-days"
              label="Días hacia adelante"
              value={values.maxDaysAhead}
              onChange={(value) => set('maxDaysAhead', value)}
              min={1}
              max={90}
            />
          </div>

          <div className="space-y-1.5">
            <Label htmlFor="resv-lead">Anticipación mínima</Label>
            <select
              id="resv-lead"
              value={values.minLeadMinutes}
              onChange={(event) =>
                set('minLeadMinutes', Number(event.target.value))
              }
              className="rounded-control border-input bg-background h-11 w-full border px-3 text-sm"
            >
              {LEAD_OPTIONS.map((option) => (
                <option key={option.value} value={option.value}>
                  {option.label}
                </option>
              ))}
            </select>
          </div>

          <div className="space-y-1.5">
            <Label htmlFor="resv-policy">Política para tus clientes</Label>
            <Textarea
              id="resv-policy"
              value={values.policyText}
              maxLength={280}
              placeholder="Ej.: guardamos la mesa 15 minutos. Para grupos de más de 8, escríbenos."
              onChange={(event) => set('policyText', event.target.value)}
            />
          </div>

          <div className="space-y-2">
            <Label htmlFor="resv-blocked">Fechas sin reservas</Label>
            <div className="flex gap-2">
              <Input
                id="resv-blocked"
                type="date"
                value={newDate}
                onChange={(event) => setNewDate(event.target.value)}
                className="rounded-control h-11"
              />
              <Button
                type="button"
                variant="outline"
                className="rounded-control h-11"
                disabled={!newDate || values.blockedDates.includes(newDate)}
                onClick={() => {
                  set('blockedDates', [...values.blockedDates, newDate].sort())
                  setNewDate('')
                }}
              >
                Agregar
              </Button>
            </div>
            {values.blockedDates.length > 0 ? (
              <ul className="flex flex-wrap gap-2">
                {values.blockedDates.map((date) => (
                  <li key={date}>
                    <button
                      type="button"
                      onClick={() =>
                        set(
                          'blockedDates',
                          values.blockedDates.filter((d) => d !== date),
                        )
                      }
                      className="rounded-pill bg-muted hover:bg-muted/70 inline-flex h-8 items-center gap-1 px-3 text-xs"
                    >
                      {formatReservationLongDay(date)}
                      <XIcon aria-hidden="true" className="size-3" />
                      <span className="sr-only">Quitar</span>
                    </button>
                  </li>
                ))}
              </ul>
            ) : null}
          </div>

          <Button
            onClick={save}
            disabled={pending}
            className="rounded-pill h-11 w-full"
          >
            {pending ? (
              <LoaderCircleIcon aria-hidden="true" className="animate-spin" />
            ) : null}
            Guardar
          </Button>
        </div>
      </SheetContent>
    </Sheet>
  )
}
