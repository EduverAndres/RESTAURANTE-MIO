'use client'

import { LoaderCircleIcon } from 'lucide-react'
import { useRouter } from 'next/navigation'
import { useId, useState, useTransition } from 'react'
import { toast } from 'sonner'
import { setStorePlan } from '@/app/admin/actions'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import {
  bogotaDate,
  FOUNDER_DAYS,
  isPlanId,
  PLAN_IDS,
  PLAN_LABELS,
  type PlanId,
} from '@/lib/plans'

interface StorePlanFormProps {
  storeId: string
  storeName: string
  plan: string
  founderUntil: string | null
}

/** Today plus FOUNDER_DAYS, on the Bogotá calendar. */
function founderDeadline(): string {
  return bogotaDate(new Date(Date.now() + FOUNDER_DAYS * 86_400_000))
}

/**
 * Plan and founder date of one store. The founder shortcut fills the date
 * in; clearing the date ends the founder offer.
 */
export function StorePlanForm({
  storeId,
  storeName,
  plan,
  founderUntil,
}: StorePlanFormProps) {
  const router = useRouter()
  const planId = useId()
  const dateId = useId()
  const [value, setValue] = useState<PlanId>(isPlanId(plan) ? plan : 'normal')
  const [until, setUntil] = useState(founderUntil ?? '')
  const [pending, startTransition] = useTransition()

  function onSubmit(event: React.FormEvent<HTMLFormElement>) {
    event.preventDefault()
    startTransition(async () => {
      const result = await setStorePlan(storeId, {
        plan: value,
        founderUntil: until === '' ? null : until,
      })
      if (!result.ok) {
        toast.error(result.error)
        return
      }
      toast.success('Plan actualizado.')
      router.refresh()
    })
  }

  return (
    <form
      onSubmit={onSubmit}
      className="flex flex-wrap items-center justify-end gap-1.5"
    >
      <label htmlFor={planId} className="sr-only">
        Plan de {storeName}
      </label>
      <select
        id={planId}
        value={value}
        onChange={(event) =>
          setValue(isPlanId(event.target.value) ? event.target.value : 'normal')
        }
        className="border-input bg-background rounded-control h-9 border px-2 text-sm"
      >
        {PLAN_IDS.map((id) => (
          <option key={id} value={id}>
            {PLAN_LABELS[id]}
          </option>
        ))}
      </select>
      <label htmlFor={dateId} className="sr-only">
        {storeName} es fundador hasta
      </label>
      <Input
        id={dateId}
        type="date"
        value={until}
        onChange={(event) => setUntil(event.target.value)}
        className="rounded-control h-9 w-36 tabular-nums"
      />
      <Button
        type="button"
        size="sm"
        variant="ghost"
        className="rounded-pill"
        onClick={() => setUntil(founderDeadline())}
      >
        Fundador {FOUNDER_DAYS} días
      </Button>
      <Button
        type="submit"
        size="sm"
        variant="outline"
        disabled={pending}
        aria-busy={pending}
        className="rounded-pill"
      >
        {pending ? (
          <LoaderCircleIcon
            aria-hidden="true"
            className="size-3.5 animate-spin"
          />
        ) : null}
        Guardar
      </Button>
    </form>
  )
}
