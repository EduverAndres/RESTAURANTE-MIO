'use client'

import { LoaderCircleIcon } from 'lucide-react'
import { useRouter } from 'next/navigation'
import { useState, useTransition } from 'react'
import { toast } from 'sonner'
import { saveAdPlacement } from '@/app/admin/publicidad/actions'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { Switch } from '@/components/ui/switch'
import type { AdPlacementSettings } from '@/lib/ads/pricing'
import { AD_PLACEMENT_LABELS } from '@/lib/ads/vocabulary'

function NumberField({
  id,
  label,
  value,
  onChange,
  min,
  max,
  step = 1,
}: {
  id: string
  label: string
  value: number
  onChange: (value: number) => void
  min: number
  max: number
  step?: number
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
        step={step}
        value={Number.isFinite(value) ? value : ''}
        onChange={(event) => onChange(Number(event.target.value))}
        className="rounded-control h-11 tabular-nums"
      />
    </div>
  )
}

/**
 * One row of the price list. A new price applies to the requests made from
 * now on; campaigns already asked keep theirs.
 */
export function AdPlacementForm({ initial }: { initial: AdPlacementSettings }) {
  const router = useRouter()
  const [values, setValues] = useState(initial)
  const [pending, startTransition] = useTransition()
  const id = `ad-placement-${initial.placement}`
  const changed = JSON.stringify(values) !== JSON.stringify(initial)
  const set = <K extends keyof AdPlacementSettings>(
    key: K,
    value: AdPlacementSettings[K],
  ) => setValues((current) => ({ ...current, [key]: value }))

  const save = () => {
    startTransition(async () => {
      const result = await saveAdPlacement({
        placement: values.placement,
        dailyPrice: values.daily_price,
        maxSlots: values.max_slots,
        minDays: values.min_days,
        maxDays: values.max_days,
        active: values.active,
      })
      if (!result.ok) {
        toast.error(result.error)
        return
      }
      toast.success(`${AD_PLACEMENT_LABELS[values.placement]}: guardado.`)
      router.refresh()
    })
  }

  return (
    <form
      className="rounded-card bg-card shadow-1 p-card space-y-4"
      onSubmit={(event) => {
        event.preventDefault()
        save()
      }}
      aria-labelledby={`${id}-title`}
    >
      <div className="flex items-center justify-between gap-3">
        <h3 id={`${id}-title`} className="font-medium">
          {AD_PLACEMENT_LABELS[values.placement]}
        </h3>
        <div className="flex items-center gap-2">
          <Switch
            id={`${id}-active`}
            checked={values.active}
            onCheckedChange={(checked) => set('active', checked)}
          />
          <Label htmlFor={`${id}-active`} className="text-sm">
            {values.active ? 'A la venta' : 'Pausada'}
          </Label>
        </div>
      </div>
      <div className="grid grid-cols-2 gap-3">
        <NumberField
          id={`${id}-price`}
          label="Precio por día ($)"
          value={values.daily_price}
          onChange={(value) => set('daily_price', value)}
          min={1000}
          max={1_000_000}
          step={500}
        />
        <NumberField
          id={`${id}-slots`}
          label={
            values.placement === 'category_top'
              ? 'Cupos por categoría'
              : 'Cupos por día'
          }
          value={values.max_slots}
          onChange={(value) => set('max_slots', value)}
          min={1}
          max={20}
        />
        <NumberField
          id={`${id}-min`}
          label="Días mínimos"
          value={values.min_days}
          onChange={(value) => set('min_days', value)}
          min={1}
          max={90}
        />
        <NumberField
          id={`${id}-max`}
          label="Días máximos"
          value={values.max_days}
          onChange={(value) => set('max_days', value)}
          min={1}
          max={90}
        />
      </div>
      <Button
        type="submit"
        size="sm"
        className="rounded-pill"
        disabled={!changed || pending}
      >
        {pending ? (
          <LoaderCircleIcon aria-hidden="true" className="animate-spin" />
        ) : null}
        Guardar
      </Button>
    </form>
  )
}
