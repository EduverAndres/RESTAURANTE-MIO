import { LocateOffIcon, ShieldAlertIcon, TriangleAlertIcon } from 'lucide-react'
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
  // The icon says what kind of problem it is: no location on this device,
  // an insecure connection (not the device's fault), or a passing failure.
  const Icon =
    reason === 'insecure'
      ? ShieldAlertIcon
      : reason === 'unsupported' || reason === 'denied'
        ? LocateOffIcon
        : TriangleAlertIcon
  return (
    <p
      role="status"
      data-reason={reason}
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
