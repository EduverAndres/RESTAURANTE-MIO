import type { LucideIcon } from 'lucide-react'
import { Sparkline } from '@/components/ui/sparkline'

interface KpiTileProps {
  label: string
  value: string
  hint?: string
  /** Decorative: the label already names the metric. */
  icon?: LucideIcon
  /** One number per bucket of the selected period. */
  trend?: readonly number[]
}

/**
 * One number, and the shape it made getting there.
 *
 * A KPI on its own answers "how much"; the sparkline answers "compared to
 * what", which is the question a merchant actually opens this screen with.
 * It costs one path and no extra query — the series is already on the page
 * for the chart underneath.
 */
export function KpiTile({
  label,
  value,
  hint,
  icon: Icon,
  trend,
}: KpiTileProps) {
  return (
    <div className="rounded-card border-border bg-card shadow-1 flex flex-col gap-1 border p-4">
      <dt className="text-muted-foreground flex items-center gap-1.5 text-xs font-medium tracking-wide uppercase">
        {Icon ? <Icon aria-hidden="true" className="size-3.5" /> : null}
        {label}
      </dt>
      <dd className="font-display text-h3 leading-none font-semibold tabular-nums">
        {value}
      </dd>
      {hint ? <dd className="text-muted-foreground text-xs">{hint}</dd> : null}
      {trend && trend.length > 1 ? (
        <dd className="mt-auto pt-2">
          <Sparkline values={trend} />
        </dd>
      ) : null}
    </div>
  )
}
