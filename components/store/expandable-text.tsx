'use client'

import { useId, useState } from 'react'
import { cn } from '@/lib/utils'

interface ExpandableTextProps {
  text: string
  /** Longer than this and the "Ver más" control appears. */
  limit?: number
  className?: string
}

/**
 * A long review clamped to three lines with a real toggle button. The full
 * text is always in the DOM, so it is searchable and reachable by a screen
 * reader whether or not the visitor expanded it.
 */
export function ExpandableText({
  text,
  limit = 180,
  className,
}: ExpandableTextProps) {
  const [expanded, setExpanded] = useState(false)
  const id = useId()
  const long = text.length > limit

  return (
    <div className={className}>
      <p id={id} className={cn(!expanded && long && 'line-clamp-3')}>
        {text}
      </p>
      {long ? (
        <button
          type="button"
          onClick={() => setExpanded((value) => !value)}
          aria-expanded={expanded}
          aria-controls={id}
          className="store-link mt-1 text-sm font-medium"
        >
          {expanded ? 'Ver menos' : 'Ver más'}
        </button>
      ) : null}
    </div>
  )
}
