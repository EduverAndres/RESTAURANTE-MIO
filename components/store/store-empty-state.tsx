import { cn } from '@/lib/utils'

type Illustration = 'menu' | 'search' | 'error'

function Drawing({ kind }: { kind: Illustration }) {
  const common = {
    viewBox: '0 0 160 120',
    fill: 'none',
    'aria-hidden': true as const,
    focusable: 'false' as const,
    className: 'h-28 w-auto',
  }

  if (kind === 'search') {
    return (
      <svg {...common}>
        <circle
          cx="70"
          cy="56"
          r="30"
          stroke="var(--store-primary)"
          strokeWidth="3"
          opacity="0.9"
        />
        <circle
          cx="70"
          cy="56"
          r="18"
          fill="var(--store-accent)"
          opacity="0.18"
        />
        <path
          d="M92 78 L116 100"
          stroke="var(--store-primary)"
          strokeWidth="6"
          strokeLinecap="round"
        />
        <path
          d="M58 52 q12 -10 24 0"
          stroke="var(--store-primary)"
          strokeWidth="3"
          strokeLinecap="round"
          opacity="0.6"
        />
        <path
          d="M60 66 q10 8 20 0"
          stroke="var(--store-primary)"
          strokeWidth="3"
          strokeLinecap="round"
          opacity="0.4"
        />
      </svg>
    )
  }

  if (kind === 'error') {
    return (
      <svg {...common}>
        <path
          d="M80 22 L136 100 H24 Z"
          stroke="var(--store-primary)"
          strokeWidth="3"
          strokeLinejoin="round"
          fill="var(--store-accent)"
          fillOpacity="0.12"
        />
        <path
          d="M80 52 v22"
          stroke="var(--store-primary)"
          strokeWidth="5"
          strokeLinecap="round"
        />
        <circle cx="80" cy="87" r="3.5" fill="var(--store-primary)" />
      </svg>
    )
  }

  return (
    <svg {...common}>
      <ellipse
        cx="80"
        cy="84"
        rx="52"
        ry="13"
        fill="var(--store-primary)"
        opacity="0.1"
      />
      <ellipse
        cx="80"
        cy="78"
        rx="52"
        ry="13"
        stroke="var(--store-primary)"
        strokeWidth="3"
      />
      <path
        d="M48 46c0 19 14 30 32 30s32-11 32-30H48Z"
        fill="var(--store-primary)"
        opacity="0.85"
      />
      <path
        d="M66 32c-3-5 3-8 0-13M80 28c-3-5 3-8 0-13M94 32c-3-5 3-8 0-13"
        stroke="var(--store-accent)"
        strokeWidth="3"
        strokeLinecap="round"
      />
    </svg>
  )
}

interface StoreEmptyStateProps {
  title: string
  description?: string
  illustration?: Illustration
  action?: React.ReactNode
  className?: string
}

/**
 * The storefront's own empty and error state: drawn inline with the tenant's
 * colours, so an empty menu still looks like this shop and not like a generic
 * placeholder from another product.
 */
export function StoreEmptyState({
  title,
  description,
  illustration = 'menu',
  action,
  className,
}: StoreEmptyStateProps) {
  return (
    <div
      role="status"
      className={cn(
        'flex flex-col items-center justify-center gap-4 rounded-[var(--store-radius)] border border-dashed border-[rgb(var(--store-text-rgb)/0.15)] bg-[rgb(var(--store-surface-rgb)/0.6)] px-6 py-14 text-center',
        className,
      )}
    >
      <Drawing kind={illustration} />
      <div className="max-w-md space-y-1.5">
        <h3 className="store-heading text-h3 text-[var(--store-text)]">
          {title}
        </h3>
        {description ? (
          <p className="text-sm text-[rgb(var(--store-text-rgb)/0.7)]">
            {description}
          </p>
        ) : null}
      </div>
      {action ? <div className="pt-1">{action}</div> : null}
    </div>
  )
}
