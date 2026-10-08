import { InfoIcon, TriangleAlertIcon } from 'lucide-react'
import type { QrBase } from '@/lib/tables/qr-reach'
import { cn } from '@/lib/utils'

/**
 * Tells the merchant, before they print anything, whether the codes on this
 * page will open on a customer's phone — and where they point.
 */
export function QrReachNotice({
  base,
  className,
}: {
  base: QrBase
  className?: string
}) {
  if (!base.warning) return null
  const blocking = !base.reachable
  const Icon = blocking ? TriangleAlertIcon : InfoIcon

  return (
    <div
      role={blocking ? 'alert' : 'note'}
      className={cn(
        'rounded-card flex gap-3 border p-4 text-sm',
        blocking
          ? 'border-destructive/30 bg-destructive/8 text-foreground'
          : 'border-accent/40 bg-accent/10 text-foreground',
        className,
      )}
    >
      <Icon
        aria-hidden="true"
        className={cn(
          'mt-0.5 size-5 shrink-0',
          blocking ? 'text-destructive-on-tint' : 'text-accent',
        )}
      />
      <div className="space-y-1">
        <p className="font-medium">
          {blocking
            ? 'Estos QR no abrirán en un celular'
            : 'Los QR apuntan a este equipo'}
        </p>
        <p className="text-muted-foreground">{base.warning}</p>
        <p className="text-muted-foreground">
          Dirección de los QR:{' '}
          <span className="text-foreground font-mono text-xs break-all">
            {base.origin}
          </span>
        </p>
      </div>
    </div>
  )
}
