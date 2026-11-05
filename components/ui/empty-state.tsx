import {
  EmptyIllustration,
  type EmptyIllustrationName,
} from '@/components/ui/empty-illustrations'
import { cn } from '@/lib/utils'

interface EmptyStateProps {
  title: string
  description?: string
  action?: React.ReactNode
  className?: string
  /** Which drawing of the family; the plate when nothing else fits. */
  illustration?: EmptyIllustrationName
}

export function EmptyState({
  title,
  description,
  action,
  className,
  illustration = 'plate',
}: EmptyStateProps) {
  return (
    <div
      role="status"
      className={cn(
        'rounded-card border-border bg-card/60 flex flex-col items-center justify-center gap-4 border border-dashed px-6 py-14 text-center',
        className,
      )}
    >
      <EmptyIllustration name={illustration} />
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
