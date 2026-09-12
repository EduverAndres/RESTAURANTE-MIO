import { cn } from '@/lib/utils'

interface EmptyStateProps {
  title: string
  description?: string
  action?: React.ReactNode
  className?: string
}

function EmptyPlateIllustration() {
  return (
    <svg
      viewBox="0 0 160 120"
      aria-hidden="true"
      className="text-muted-foreground/60 h-28 w-auto"
      fill="none"
    >
      {/* Table line */}
      <path
        d="M14 104h132"
        stroke="currentColor"
        strokeWidth="2"
        strokeLinecap="round"
        strokeDasharray="4 6"
      />
      {/* Plate */}
      <ellipse
        cx="80"
        cy="82"
        rx="54"
        ry="14"
        fill="currentColor"
        opacity="0.12"
      />
      <ellipse
        cx="80"
        cy="78"
        rx="54"
        ry="14"
        stroke="currentColor"
        strokeWidth="2"
      />
      <ellipse
        cx="80"
        cy="78"
        rx="36"
        ry="9"
        stroke="currentColor"
        strokeWidth="1.5"
        opacity="0.5"
      />
      {/* Bowl */}
      <path
        d="M46 46c0 20 15 32 34 32s34-12 34-32H46Z"
        fill="var(--primary)"
        opacity="0.9"
      />
      <path
        d="M52 46c4 10 14 18 28 18s24-8 28-18"
        stroke="var(--primary-foreground)"
        strokeWidth="1.5"
        opacity="0.35"
        strokeLinecap="round"
      />
      {/* Steam */}
      <path
        d="M66 34c-3-5 3-8 0-13M80 30c-3-5 3-8 0-13M94 34c-3-5 3-8 0-13"
        stroke="var(--accent)"
        strokeWidth="2"
        strokeLinecap="round"
      />
      {/* Cutlery */}
      <path
        d="M22 40v40M18 40v12a4 4 0 0 0 8 0V40"
        stroke="currentColor"
        strokeWidth="2"
        strokeLinecap="round"
      />
      <path
        d="M138 40v40M138 40c-6 4-6 16 0 20"
        stroke="currentColor"
        strokeWidth="2"
        strokeLinecap="round"
      />
    </svg>
  )
}

export function EmptyState({
  title,
  description,
  action,
  className,
}: EmptyStateProps) {
  return (
    <div
      role="status"
      className={cn(
        'rounded-card border-border bg-card/60 flex flex-col items-center justify-center gap-4 border border-dashed px-6 py-14 text-center',
        className,
      )}
    >
      <EmptyPlateIllustration />
      <div className="max-w-md space-y-1.5">
        <h3 className="font-display text-foreground text-xl">{title}</h3>
        {description ? (
          <p className="text-muted-foreground text-sm">{description}</p>
        ) : null}
      </div>
      {action ? <div className="pt-1">{action}</div> : null}
    </div>
  )
}
