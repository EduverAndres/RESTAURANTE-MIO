import { sparklineGeometry, trendDirection } from '@/lib/metrics/sparkline'
import { cn } from '@/lib/utils'

const VIEW = { width: 120, height: 32 }

interface SparklineProps {
  values: readonly number[]
  className?: string
}

/**
 * The shape of a number over time, at the size of a word.
 *
 * It is `aria-hidden` on purpose: the KPI beside it already states the
 * current value, the period selector states the window, and the full series
 * is available as a real table in the chart below. A screen reader does not
 * need a second, vaguer version of the same data — it needs the number.
 *
 * `preserveAspectRatio="none"` lets it stretch to whatever width the tile
 * ends up with; `vector-effect` keeps the stroke a stroke while it does.
 */
export function Sparkline({ values, className }: SparklineProps) {
  const geometry = sparklineGeometry(values, { ...VIEW, padding: 3 })
  if (!geometry) return null
  const direction = trendDirection(values)

  return (
    <svg
      aria-hidden="true"
      focusable="false"
      viewBox={`0 0 ${VIEW.width} ${VIEW.height}`}
      preserveAspectRatio="none"
      className={cn(
        'h-8 w-full',
        direction === 'down' ? 'text-muted-foreground' : 'text-primary',
        className,
      )}
    >
      <path d={geometry.area} fill="currentColor" opacity={0.12} />
      <path
        d={geometry.line}
        fill="none"
        stroke="currentColor"
        strokeWidth={2}
        strokeLinecap="round"
        strokeLinejoin="round"
        vectorEffect="non-scaling-stroke"
      />
      <circle
        cx={geometry.last.x}
        cy={geometry.last.y}
        r={2.5}
        fill="currentColor"
        vectorEffect="non-scaling-stroke"
      />
    </svg>
  )
}
