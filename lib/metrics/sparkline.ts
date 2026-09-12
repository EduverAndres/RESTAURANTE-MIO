// Geometry for the KPI sparklines. Pure module: it turns a series of numbers
// into two SVG path strings and nothing else, so the shape of the line can be
// asserted in a test instead of eyeballed in a browser.

export interface SparklineOptions {
  width: number
  height: number
  /** Vertical breathing room, so a peak is not clipped by the stroke. */
  padding?: number
}

export interface SparklineGeometry {
  /** The `d` of the line itself. */
  line: string
  /** The same line closed along the baseline, for a soft fill underneath. */
  area: string
  /** The most recent point, for the dot that marks "you are here". */
  last: { x: number; y: number }
}

/** Two decimals is more than a 200px-wide chart can show. */
function round(value: number): number {
  return Math.round(value * 100) / 100
}

/**
 * Returns `null` for fewer than two points: one number is not a trend, and a
 * single dot floating in a box reads as a rendering bug.
 */
export function sparklineGeometry(
  values: readonly number[],
  { width, height, padding = 0 }: SparklineOptions,
): SparklineGeometry | null {
  if (values.length < 2) return null

  const min = Math.min(...values)
  const max = Math.max(...values)
  const span = max - min
  const usable = Math.max(0, height - padding * 2)
  const step = width / (values.length - 1)

  const points = values.map((value, index) => {
    // A flat series has no shape to show, so it rides down the middle
    // instead of collapsing onto an arbitrary edge.
    const normalised = span === 0 ? 0.5 : (value - min) / span
    return {
      x: round(index * step),
      y: round(padding + (1 - normalised) * usable),
    }
  })

  const line = points
    .map((point, index) => `${index === 0 ? 'M' : 'L'} ${point.x} ${point.y}`)
    .join(' ')
  const first = points[0]
  const last = points[points.length - 1]

  return {
    line,
    area: `${line} L ${last.x} ${height} L ${first.x} ${height} Z`,
    last,
  }
}

export type TrendDirection = 'up' | 'down' | 'flat'

/**
 * Where the last bucket sits against the average of the ones before it.
 * Deliberately not "last vs. previous": a single quiet hour is noise, and an
 * arrow that flips on noise is an arrow nobody trusts.
 */
export function trendDirection(values: readonly number[]): TrendDirection {
  if (values.length < 2) return 'flat'
  const history = values.slice(0, -1)
  const baseline =
    history.reduce((sum, value) => sum + value, 0) / history.length
  const last = values[values.length - 1]
  if (last > baseline + 1e-9) return 'up'
  if (last < baseline - 1e-9) return 'down'
  return 'flat'
}
