'use client'

import { LoaderCircleIcon } from 'lucide-react'
import { useRouter } from 'next/navigation'
import { useId, useState, useTransition } from 'react'
import { toast } from 'sonner'
import { saveLoyaltyProgram } from '@/app/dashboard/fidelidad/actions'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { Switch } from '@/components/ui/switch'
import { formatCOP } from '@/lib/format'

export interface LoyaltyFormValues {
  enabled: boolean
  stampsRequired: number
  minOrder: number
  rewardLabel: string
  rewardValue: number
}

/**
 * The store's stamp card. The store pays the reward: it comes off the
 * order where the customer uses it, and the commission is charged on what
 * the customer actually pays.
 */
export function LoyaltyForm({
  storeId,
  initial,
}: {
  storeId: string
  initial: LoyaltyFormValues
}) {
  const router = useRouter()
  const ids = {
    enabled: useId(),
    stamps: useId(),
    min: useId(),
    label: useId(),
    value: useId(),
  }
  const [values, setValues] = useState(initial)
  const [pending, startTransition] = useTransition()
  const set = <K extends keyof LoyaltyFormValues>(
    key: K,
    value: LoyaltyFormValues[K],
  ) => setValues((current) => ({ ...current, [key]: value }))

  function onSubmit(event: React.FormEvent<HTMLFormElement>) {
    event.preventDefault()
    startTransition(async () => {
      const result = await saveLoyaltyProgram(storeId, values)
      if (!result.ok) {
        toast.error(result.error)
        return
      }
      toast.success(
        values.enabled ? 'Tarjeta de sellos activa.' : 'Tarjeta guardada.',
      )
      router.refresh()
    })
  }

  return (
    <form onSubmit={onSubmit} className="space-y-4">
      <div className="flex items-center justify-between gap-3">
        <Label htmlFor={ids.enabled}>Tarjeta de sellos activa</Label>
        <Switch
          id={ids.enabled}
          checked={values.enabled}
          onCheckedChange={(checked) => set('enabled', checked)}
        />
      </div>

      <div className="grid gap-4 sm:grid-cols-2">
        <div className="space-y-1.5">
          <Label htmlFor={ids.stamps}>Sellos para el premio</Label>
          <Input
            id={ids.stamps}
            type="number"
            min={3}
            max={20}
            value={values.stampsRequired}
            onChange={(event) =>
              set('stampsRequired', Number(event.target.value))
            }
            className="tabular-nums"
          />
        </div>
        <div className="space-y-1.5">
          <Label htmlFor={ids.min}>Pedido mínimo para sumar un sello</Label>
          <Input
            id={ids.min}
            type="number"
            min={0}
            step={1000}
            value={values.minOrder}
            onChange={(event) => set('minOrder', Number(event.target.value))}
            className="tabular-nums"
          />
        </div>
        <div className="space-y-1.5">
          <Label htmlFor={ids.label}>Premio</Label>
          <Input
            id={ids.label}
            value={values.rewardLabel}
            maxLength={60}
            placeholder="una arepa de huevo"
            onChange={(event) => set('rewardLabel', event.target.value)}
          />
        </div>
        <div className="space-y-1.5">
          <Label htmlFor={ids.value}>Valor máximo del premio</Label>
          <Input
            id={ids.value}
            type="number"
            min={0}
            step={500}
            value={values.rewardValue}
            onChange={(event) => set('rewardValue', Number(event.target.value))}
            className="tabular-nums"
          />
        </div>
      </div>

      <p className="text-muted-foreground text-sm text-pretty">
        Así lo ve el cliente: «Cada pedido entregado desde{' '}
        {formatCOP(values.minOrder)} suma un sello. Con {values.stampsRequired}{' '}
        tienes {values.rewardLabel || 'tu premio'}.» El premio se descuenta de
        un pedido, hasta {formatCOP(values.rewardValue)}, y lo pagas tú.
      </p>

      <Button type="submit" disabled={pending} className="rounded-pill">
        {pending ? (
          <LoaderCircleIcon aria-hidden="true" className="animate-spin" />
        ) : null}
        Guardar tarjeta
      </Button>
    </form>
  )
}
