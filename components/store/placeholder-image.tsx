import {
  buildPlaceholder,
  type PlaceholderShape,
} from '@/lib/store/placeholder'
import { cn } from '@/lib/utils'

function Shape({ shape, fill }: { shape: PlaceholderShape; fill: string }) {
  const transform =
    shape.rotate === 0
      ? undefined
      : `rotate(${shape.rotate} ${shape.x} ${shape.y})`

  switch (shape.kind) {
    case 'rect':
      return (
        <rect
          x={shape.x}
          y={shape.y}
          width={shape.size}
          height={shape.size}
          fill={fill}
          opacity={shape.opacity}
          transform={transform}
        />
      )
    case 'circle':
      return (
        <circle
          cx={shape.x}
          cy={shape.y}
          r={shape.size}
          fill={fill}
          opacity={shape.opacity}
          transform={transform}
        />
      )
    case 'arc':
      return (
        <path
          d={`M ${shape.x} ${shape.y} a ${shape.size} ${shape.size} 0 0 1 ${shape.size} ${shape.size} L ${shape.x} ${shape.y} Z`}
          fill={fill}
          opacity={shape.opacity}
          transform={transform}
        />
      )
    default:
      return (
        <path
          d={`M ${shape.x} ${shape.y} l ${shape.size / 2} ${shape.size} l ${shape.size / 2} ${-shape.size}`}
          fill="none"
          stroke={fill}
          strokeWidth={6}
          strokeLinecap="round"
          strokeLinejoin="round"
          opacity={shape.opacity}
          transform={transform}
        />
      )
  }
}

interface PlaceholderImageProps {
  /** Stable identity: a store slug/id or a product id. */
  seed: string
  /** The tenant's primary colour; the whole pattern is derived from it. */
  color: string
  /** Where the initials come from. */
  label: string
  className?: string
  /** Scales the initials; the pattern always fills the box. */
  initialScale?: number
}

/**
 * The stand-in for a missing photo: a geometric pattern built from the store's
 * own colour and identity, so an empty menu still looks designed. Decorative
 * by definition — the surrounding element carries the real label.
 */
export function PlaceholderImage({
  seed,
  color,
  label,
  className,
  initialScale = 1,
}: PlaceholderImageProps) {
  const placeholder = buildPlaceholder(seed, color, label)

  return (
    <svg
      viewBox="0 0 100 100"
      preserveAspectRatio="xMidYMid slice"
      aria-hidden="true"
      focusable="false"
      className={cn('size-full', className)}
    >
      <rect width="100" height="100" fill={placeholder.background} />
      {placeholder.shapes.map((shape, index) => (
        <Shape
          key={`${shape.kind}-${index}`}
          shape={shape}
          fill={placeholder.foreground}
        />
      ))}
      <text
        x="50"
        y="50"
        textAnchor="middle"
        dominantBaseline="central"
        fontSize={34 * initialScale}
        fontWeight={700}
        fill={placeholder.ink}
        style={{ fontFamily: 'var(--store-font-display)' }}
      >
        {placeholder.initial}
      </text>
    </svg>
  )
}
