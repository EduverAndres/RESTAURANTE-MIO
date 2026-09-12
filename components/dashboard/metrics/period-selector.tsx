import Link from 'next/link'
import { METRICS_PERIODS, type MetricsPeriod } from '@/lib/metrics/aggregate'
import { cn } from '@/lib/utils'

interface PeriodSelectorProps {
  current: MetricsPeriod
  /** Page the links point to; defaults to the merchant metrics page. */
  basePath?: string
}

export const PERIOD_PARAM = 'periodo'

/** Segmented links; the period lives in the URL so it survives refreshes. */
export function PeriodSelector({
  current,
  basePath = '/dashboard/metrics',
}: PeriodSelectorProps) {
  return (
    <nav aria-label="Periodo" className="bg-muted rounded-pill inline-flex p-1">
      {METRICS_PERIODS.map((period) => {
        const active = period.value === current
        return (
          <Link
            key={period.value}
            href={`${basePath}?${PERIOD_PARAM}=${period.value}`}
            aria-current={active ? 'page' : undefined}
            className={cn(
              'rounded-pill px-3 py-1.5 text-sm font-medium transition-colors',
              active
                ? 'bg-background text-foreground shadow-soft'
                : 'text-muted-foreground hover:text-foreground',
            )}
          >
            {period.label}
          </Link>
        )
      })}
    </nav>
  )
}
