import { formatCOP } from '@/lib/format'
import type { SeriesPoint } from '@/lib/metrics/aggregate'

interface BarChartProps {
  title: string
  points: SeriesPoint[]
}

const WIDTH = 720
const HEIGHT = 200
const PADDING = { top: 12, right: 8, bottom: 28, left: 28 }

/** Plain SVG bars for orders per bucket, with a visually hidden data table. */
export function BarChart({ title, points }: BarChartProps) {
  const max = Math.max(1, ...points.map((point) => point.orders))
  const innerWidth = WIDTH - PADDING.left - PADDING.right
  const innerHeight = HEIGHT - PADDING.top - PADDING.bottom
  const slot = innerWidth / Math.max(points.length, 1)
  const barWidth = Math.max(4, slot * 0.6)
  // Only label every n-th tick so 24 or 30 buckets stay legible.
  const labelEvery = Math.max(1, Math.ceil(points.length / 8))
  const total = points.reduce((sum, point) => sum + point.orders, 0)

  return (
    <figure className="rounded-card border-border bg-card shadow-1 p-card border">
      <figcaption className="mb-3 flex items-baseline justify-between gap-2">
        <span className="font-display text-xl font-semibold">{title}</span>
        <span className="text-muted-foreground text-xs">
          {total} pedido{total === 1 ? '' : 's'}
        </span>
      </figcaption>
      <svg
        viewBox={`0 0 ${WIDTH} ${HEIGHT}`}
        role="img"
        aria-label={`${title}: ${total} pedidos en ${points.length} periodos`}
        className="h-auto w-full"
      >
        <line
          x1={PADDING.left}
          x2={WIDTH - PADDING.right}
          y1={PADDING.top + innerHeight}
          y2={PADDING.top + innerHeight}
          className="stroke-border"
          strokeWidth={1}
        />
        <text
          x={PADDING.left - 6}
          y={PADDING.top + 4}
          textAnchor="end"
          className="fill-muted-foreground text-[10px]"
        >
          {max}
        </text>
        {points.map((point, index) => {
          const barHeight = (point.orders / max) * innerHeight
          const x = PADDING.left + index * slot + (slot - barWidth) / 2
          const y = PADDING.top + innerHeight - barHeight
          return (
            <g key={point.key}>
              <rect
                x={x}
                y={y}
                width={barWidth}
                height={barHeight}
                rx={3}
                className={point.orders > 0 ? 'fill-primary' : 'fill-muted'}
              >
                <title>
                  {`${point.label}: ${point.orders} pedidos, ${formatCOP(point.revenue)}`}
                </title>
              </rect>
              {index % labelEvery === 0 ? (
                <text
                  x={x + barWidth / 2}
                  y={HEIGHT - 8}
                  textAnchor="middle"
                  className="fill-muted-foreground text-[10px]"
                >
                  {point.label}
                </text>
              ) : null}
            </g>
          )
        })}
      </svg>
      <table className="sr-only">
        <caption>{title}</caption>
        <thead>
          <tr>
            <th scope="col">Periodo</th>
            <th scope="col">Pedidos</th>
            <th scope="col">Ingresos</th>
          </tr>
        </thead>
        <tbody>
          {points.map((point) => (
            <tr key={point.key}>
              <th scope="row">{point.label}</th>
              <td>{point.orders}</td>
              <td>{formatCOP(point.revenue)}</td>
            </tr>
          ))}
        </tbody>
      </table>
    </figure>
  )
}
