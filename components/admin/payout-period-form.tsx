'use client'

import { LoaderCircleIcon } from 'lucide-react'
import { useRouter } from 'next/navigation'
import { useState, useTransition } from 'react'
import { toast } from 'sonner'
import { generatePayouts } from '@/app/admin/actions'
import { Button } from '@/components/ui/button'
import { Label } from '@/components/ui/label'
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select'
import { monthBounds, weekBounds } from '@/lib/dates'

const PERIOD_OPTIONS = [
  { value: 'week-current', label: 'Semana actual' },
  { value: 'week-previous', label: 'Semana anterior' },
  { value: 'month-current', label: 'Mes actual' },
  { value: 'month-previous', label: 'Mes anterior' },
] as const

type PeriodOption = (typeof PERIOD_OPTIONS)[number]['value']

function boundsFor(option: PeriodOption, now: Date) {
  if (option === 'week-current') return weekBounds(now)
  if (option === 'week-previous') {
    const previous = new Date(now)
    previous.setDate(previous.getDate() - 7)
    return weekBounds(previous)
  }
  if (option === 'month-current') return monthBounds(now)
  const previous = new Date(now.getFullYear(), now.getMonth() - 1, 1)
  return monthBounds(previous)
}

export function PayoutPeriodForm() {
  const router = useRouter()
  const [option, setOption] = useState<PeriodOption>('week-previous')
  const [pending, startTransition] = useTransition()
  const preview = boundsFor(option, new Date())

  function onSubmit(event: React.FormEvent<HTMLFormElement>) {
    event.preventDefault()
    const bounds = boundsFor(option, new Date())
    startTransition(async () => {
      const result = await generatePayouts(bounds.start, bounds.end)
      if (!result.ok) {
        toast.error(result.error)
        return
      }
      toast.success(
        result.created > 0
          ? `Se generaron ${result.created} liquidación(es).`
          : 'No había liquidaciones nuevas para generar.',
        result.skipped > 0
          ? { description: `${result.skipped} ya existían.` }
          : undefined,
      )
      router.refresh()
    })
  }

  return (
    <form
      onSubmit={onSubmit}
      className="rounded-card border-border bg-card shadow-soft flex flex-wrap items-end gap-3 border p-4"
    >
      <div className="space-y-1.5">
        <Label htmlFor="payout-period">Periodo a liquidar</Label>
        <Select
          value={option}
          onValueChange={(value) => setOption(value as PeriodOption)}
        >
          <SelectTrigger id="payout-period" className="rounded-control h-10 w-48">
            <SelectValue />
          </SelectTrigger>
          <SelectContent>
            {PERIOD_OPTIONS.map((item) => (
              <SelectItem key={item.value} value={item.value}>
                {item.label}
              </SelectItem>
            ))}
          </SelectContent>
        </Select>
        <p className="text-muted-foreground text-xs">
          {preview.start} a {preview.end}
        </p>
      </div>
      <Button type="submit" disabled={pending} className="rounded-pill">
        {pending ? (
          <LoaderCircleIcon aria-hidden="true" className="animate-spin" />
        ) : null}
        Generar liquidaciones
      </Button>
    </form>
  )
}
