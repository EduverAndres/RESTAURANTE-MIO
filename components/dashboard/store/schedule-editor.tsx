'use client'

import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { Switch } from '@/components/ui/switch'
import { cn } from '@/lib/utils'
import {
  WEEK_DAYS,
  WEEK_DAY_LABELS,
  type ScheduleForm,
} from '@/lib/validations/store'
import type { WeekDay } from '@/types/app'

interface ScheduleEditorProps {
  value: ScheduleForm
  onChange: (next: ScheduleForm) => void
  errors?: Partial<Record<WeekDay, string>>
}

/** Seven rows: a switch to open that day plus opening and closing times. */
export function ScheduleEditor({
  value,
  onChange,
  errors,
}: ScheduleEditorProps) {
  function update(day: WeekDay, patch: Partial<ScheduleForm[WeekDay]>) {
    onChange({ ...value, [day]: { ...value[day], ...patch } })
  }

  return (
    <div className="divide-border/60 rounded-card border-border bg-card divide-y border">
      {WEEK_DAYS.map((day) => {
        const entry = value[day]
        const error = errors?.[day]
        return (
          <div
            key={day}
            className="grid grid-cols-[1fr_auto] items-center gap-3 px-4 py-3 sm:grid-cols-[8rem_1fr]"
          >
            <div className="flex items-center gap-3">
              <Switch
                id={`schedule-${day}`}
                checked={entry.enabled}
                onCheckedChange={(enabled) => update(day, { enabled })}
                aria-label={`Abrir los ${WEEK_DAY_LABELS[day].toLowerCase()}`}
              />
              <Label htmlFor={`schedule-${day}`} className="text-sm">
                {WEEK_DAY_LABELS[day]}
              </Label>
            </div>
            <div
              className={cn(
                'col-span-2 flex flex-wrap items-center gap-2 sm:col-span-1',
                !entry.enabled && 'opacity-50',
              )}
            >
              <Label htmlFor={`schedule-${day}-open`} className="sr-only">
                Hora de apertura, {WEEK_DAY_LABELS[day]}
              </Label>
              <Input
                id={`schedule-${day}-open`}
                type="time"
                value={entry.open}
                disabled={!entry.enabled}
                onChange={(event) => update(day, { open: event.target.value })}
                aria-invalid={Boolean(error)}
                className="rounded-control h-10 w-32"
              />
              <span className="text-muted-foreground text-sm">a</span>
              <Label htmlFor={`schedule-${day}-close`} className="sr-only">
                Hora de cierre, {WEEK_DAY_LABELS[day]}
              </Label>
              <Input
                id={`schedule-${day}-close`}
                type="time"
                value={entry.close}
                disabled={!entry.enabled}
                onChange={(event) => update(day, { close: event.target.value })}
                aria-invalid={Boolean(error)}
                className="rounded-control h-10 w-32"
              />
              {!entry.enabled ? (
                <span className="text-muted-foreground text-xs">Cerrado</span>
              ) : null}
              {error ? (
                <p role="alert" className="text-destructive w-full text-xs">
                  {error}
                </p>
              ) : null}
            </div>
          </div>
        )
      })}
    </div>
  )
}
