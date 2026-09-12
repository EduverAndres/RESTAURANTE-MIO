import { Badge } from '@/components/ui/badge'
import {
  STORE_STATUS_LABELS,
  STORE_STATUS_TONES,
  orderStatusLabel,
  orderStatusTone,
  paymentStatusLabel,
  paymentStatusTone,
  type StatusTone,
} from '@/lib/orders/status'
import { cn } from '@/lib/utils'
import type { StoreStatus } from '@/types/app'

const TONE_CLASSES: Record<StatusTone, string> = {
  neutral: 'bg-muted text-muted-foreground',
  info: 'bg-sky-500/12 text-sky-700 dark:text-sky-300',
  warning: 'bg-accent/20 text-amber-800 dark:text-amber-300',
  primary: 'bg-primary/12 text-primary',
  success: 'bg-success/12 text-success',
  destructive: 'bg-destructive/12 text-destructive',
}

interface StatusBadgeProps {
  label: string
  tone: StatusTone
  className?: string
}

export function StatusBadge({ label, tone, className }: StatusBadgeProps) {
  return (
    <Badge
      variant="outline"
      className={cn(
        'rounded-pill border-transparent px-2.5 py-0.5 text-xs font-medium',
        TONE_CLASSES[tone],
        className,
      )}
    >
      {label}
    </Badge>
  )
}

export function OrderStatusBadge({
  status,
  className,
}: {
  status: string
  className?: string
}) {
  return (
    <StatusBadge
      label={orderStatusLabel(status)}
      tone={orderStatusTone(status)}
      className={className}
    />
  )
}

export function PaymentStatusBadge({
  status,
  className,
}: {
  status: string
  className?: string
}) {
  return (
    <StatusBadge
      label={paymentStatusLabel(status)}
      tone={paymentStatusTone(status)}
      className={className}
    />
  )
}

export function StoreStatusBadge({
  status,
  className,
}: {
  status: StoreStatus
  className?: string
}) {
  return (
    <StatusBadge
      label={STORE_STATUS_LABELS[status]}
      tone={STORE_STATUS_TONES[status]}
      className={className}
    />
  )
}
