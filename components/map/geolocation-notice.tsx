import { LocateOffIcon, TriangleAlertIcon } from 'lucide-react'
import {
  geolocationFailureMessage,
  type GeolocationFailure,
} from '@/lib/geo/geolocation-availability'
import { cn } from '@/lib/utils'

interface GeolocationNoticeProps {
  reason: GeolocationFailure
  className?: string
}

/**
 * Inline explanation of why "Usar mi ubicación" cannot work. Shown next to
 * the manual search and map so the fallback is obvious.
 */
export function GeolocationNotice({
  reason,
  className,
}: GeolocationNoticeProps) {
  const noGps = reason === 'unsupported' || reason === 'insecure'
  const Icon = noGps ? LocateOffIcon : TriangleAlertIcon
  return (
    <p
      role="status"
      className={cn(
        'rounded-control bg-muted/60 text-muted-foreground flex items-start gap-2 px-3 py-2.5 text-xs',
        className,
      )}
    >
      <Icon aria-hidden="true" className="mt-0.5 size-4 shrink-0" />
      <span>{geolocationFailureMessage(reason)}</span>
    </p>
  )
}
