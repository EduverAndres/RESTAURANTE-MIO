'use client'

import { CheckIcon, LoaderCircleIcon, MegaphoneIcon } from 'lucide-react'
import { useRouter } from 'next/navigation'
import { useId, useState, useTransition } from 'react'
import { toast } from 'sonner'
import { requestAdCampaign } from '@/app/dashboard/publicidad/actions'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { freeSlots, overlapsOwn, type SlotCampaign } from '@/lib/ads/capacity'
import {
  MAX_START_AHEAD_DAYS,
  daysLabel,
  formatAdRange,
  quoteAdCampaign,
  type AdPlacementSettings,
} from '@/lib/ads/pricing'
import {
  AD_PLACEMENT_DESCRIPTIONS,
  AD_PLACEMENT_LABELS,
  type AdPlacement,
} from '@/lib/ads/vocabulary'
import { formatCOP } from '@/lib/format'
import { addDays } from '@/lib/store/hours'
import { cn } from '@/lib/utils'

interface AdRequestFormProps {
  placements: AdPlacementSettings[]
  /** Approved campaigns of every store, for the live "hay cupo" check. */
  occupancy: SlotCampaign[]
  /** The store's own campaigns, so a second one on the same days is caught. */
  own: SlotCampaign[]
  /** The store's category: the page a category campaign shows on. */
  category: string | null
  /** Bogotá date, from the server. */
  today: string
  /** Why the store cannot ask right now, if it cannot. */
  blockedReason: string | null
}

/**
 * Ask for a campaign: pick a placement and the dates, see the price and
 * whether there is room as you type, then send it for approval. The quote
 * is lib/ads/pricing.ts's, the same the server checks again.
 */
export function AdRequestForm({
  placements,
  occupancy,
  own,
  category,
  today,
  blockedReason,
}: AdRequestFormProps) {
  const router = useRouter()
  const id = useId()
  const available = placements.filter(
    (row) => row.active && (row.placement !== 'category_top' || category),
  )
  const [placement, setPlacement] = useState<AdPlacement | null>(
    available[0]?.placement ?? null,
  )
  const settings = placements.find((row) => row.placement === placement)
  const [startsOn, setStartsOn] = useState(today)
  const [endsOn, setEndsOn] = useState(
    addDays(today, (available[0]?.min_days ?? 1) - 1),
  )
  const [pending, startTransition] = useTransition()

  const quote = settings
    ? quoteAdCampaign({ settings, startsOn, endsOn, today })
    : null
  const free =
    settings && quote?.ok
      ? freeSlots(
          occupancy,
          {
            placement: settings.placement,
            starts_on: startsOn,
            ends_on: endsOn,
            category_snapshot: category,
          },
          settings.max_slots,
        )
      : null
  const duplicate =
    settings && quote?.ok
      ? overlapsOwn(own, {
          placement: settings.placement,
          starts_on: startsOn,
          ends_on: endsOn,
          category_snapshot: category,
        })
      : false
  const canSubmit =
    !blockedReason &&
    quote?.ok === true &&
    !duplicate &&
    free !== null &&
    free > 0

  const choose = (next: AdPlacementSettings) => {
    setPlacement(next.placement)
    // Keep the start; stretch the end to the new minimum if it fell short.
    const minEnd = addDays(startsOn, next.min_days - 1)
    if (endsOn < minEnd) setEndsOn(minEnd)
  }

  const submit = () => {
    if (!placement) return
    startTransition(async () => {
      const result = await requestAdCampaign({ placement, startsOn, endsOn })
      if (!result.ok) {
        toast.error(result.error)
        return
      }
      toast.success(
        'Solicitud enviada. Te avisamos cuando la revisemos; no se cobra nada hasta que salga al aire.',
      )
      router.refresh()
    })
  }

  if (available.length === 0) {
    return (
      <p className="text-muted-foreground text-sm">
        No hay ubicaciones disponibles por ahora.
      </p>
    )
  }

  return (
    <div className="space-y-6">
      <fieldset className="space-y-3">
        <legend className="mb-3 text-sm font-medium">
          ¿Dónde quieres aparecer?
        </legend>
        <div className="gap-card grid sm:grid-cols-3">
          {placements.map((row) => {
            const disabled =
              !row.active || (row.placement === 'category_top' && !category)
            const checked = row.placement === placement
            return (
              <label
                key={row.placement}
                className={cn(
                  'rounded-card bg-card shadow-1 p-card relative flex cursor-pointer flex-col gap-2 ring-2 ring-transparent transition-shadow',
                  checked && 'ring-primary shadow-2',
                  disabled && 'cursor-not-allowed opacity-60',
                )}
              >
                <input
                  type="radio"
                  name={`${id}-placement`}
                  value={row.placement}
                  checked={checked}
                  disabled={disabled}
                  onChange={() => choose(row)}
                  className="sr-only"
                />
                <span className="flex items-start justify-between gap-2">
                  <span className="font-medium">
                    {AD_PLACEMENT_LABELS[row.placement]}
                  </span>
                  {checked ? (
                    <CheckIcon
                      aria-hidden="true"
                      className="text-primary size-5 shrink-0"
                    />
                  ) : null}
                </span>
                <span className="text-muted-foreground text-sm text-pretty">
                  {AD_PLACEMENT_DESCRIPTIONS[row.placement]}
                  {row.placement === 'category_top' && category
                    ? ` Tu categoría: ${category}.`
                    : ''}
                </span>
                <span className="mt-auto text-sm">
                  <span className="font-display text-lg font-semibold tabular-nums">
                    {formatCOP(row.daily_price)}
                  </span>{' '}
                  por día
                </span>
                {disabled ? (
                  <span className="text-muted-foreground text-xs">
                    {row.active
                      ? 'Elige primero la categoría de tu tienda.'
                      : 'No disponible por ahora.'}
                  </span>
                ) : null}
              </label>
            )
          })}
        </div>
      </fieldset>

      <div className="grid gap-4 sm:grid-cols-2">
        <div className="space-y-1.5">
          <Label htmlFor={`${id}-start`}>Primer día</Label>
          <Input
            id={`${id}-start`}
            type="date"
            min={today}
            max={addDays(today, MAX_START_AHEAD_DAYS)}
            value={startsOn}
            onChange={(event) => setStartsOn(event.target.value)}
            className="rounded-control h-11"
          />
        </div>
        <div className="space-y-1.5">
          <Label htmlFor={`${id}-end`}>Último día</Label>
          <Input
            id={`${id}-end`}
            type="date"
            min={startsOn || today}
            value={endsOn}
            onChange={(event) => setEndsOn(event.target.value)}
            className="rounded-control h-11"
            aria-describedby={`${id}-days-hint`}
          />
          {settings ? (
            <p id={`${id}-days-hint`} className="text-muted-foreground text-xs">
              Entre {daysLabel(settings.min_days)} y{' '}
              {daysLabel(settings.max_days)}, ambos días incluidos.
            </p>
          ) : null}
        </div>
      </div>

      {/* The live quote. Polite: it updates as the dates change. */}
      <div
        aria-live="polite"
        className="rounded-card bg-secondary/40 p-card space-y-1"
      >
        {quote === null ? null : quote.ok ? (
          <>
            <p className="text-sm">
              {formatAdRange(startsOn, endsOn)} · {daysLabel(quote.days)} ×{' '}
              {formatCOP(quote.dailyPrice)}
            </p>
            <p className="font-display text-h3 font-semibold tabular-nums">
              {formatCOP(quote.total)}
            </p>
            <p
              className={cn(
                'text-sm font-medium',
                !duplicate && free && free > 0
                  ? 'text-success-on-tint'
                  : 'text-destructive',
              )}
            >
              {duplicate
                ? 'Ya tienes una campaña en esta ubicación en esas fechas.'
                : free && free > 0
                  ? free === 1
                    ? 'Queda 1 cupo en esas fechas.'
                    : `Quedan ${free} cupos en esas fechas.`
                  : 'No quedan cupos en esas fechas. Prueba con otras.'}
            </p>
            <p className="text-muted-foreground text-xs text-pretty">
              Es el valor máximo: se descuenta de tus liquidaciones solo por los
              días que tu anuncio esté al aire. Si lo pausamos, esos días no se
              cobran.
            </p>
          </>
        ) : (
          <p className="text-destructive text-sm font-medium">
            {quote.message}
          </p>
        )}
      </div>

      {blockedReason ? (
        <p className="text-destructive text-sm font-medium">{blockedReason}</p>
      ) : null}

      <Button
        className="rounded-pill"
        disabled={!canSubmit || pending}
        onClick={submit}
      >
        {pending ? (
          <LoaderCircleIcon aria-hidden="true" className="animate-spin" />
        ) : (
          <MegaphoneIcon aria-hidden="true" />
        )}
        Solicitar campaña
      </Button>
    </div>
  )
}
