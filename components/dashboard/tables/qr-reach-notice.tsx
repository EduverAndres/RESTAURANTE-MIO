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
          blocking ? 'text-destructive-on-tint' : 'text-accent-strong',
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

const INACTIVE_COPY: Record<
  'pending' | 'suspended',
  { title: string; body: string }
> = {
  pending: {
    title: 'Tu tienda todavía está en revisión',
    body: 'Puedes preparar e imprimir los QR, pero hasta que activemos tu tienda quien los escanee verá «Este código QR ya no es válido».',
  },
  suspended: {
    title: 'Tu tienda está suspendida',
    body: 'Mientras siga suspendida, quien escanee un QR verá «Este código QR ya no es válido». Escríbenos para reactivarla.',
  },
}

/**
 * Table codes only resolve for an active store (`resolve_store_table`), so
 * before activation every printed code reads as broken. Say so up front.
 */
export function StoreInactiveNotice({
  status,
  className,
}: {
  status: string
  className?: string
}) {
  if (status !== 'pending' && status !== 'suspended') return null
  const copy = INACTIVE_COPY[status]

  return (
    <div
      role="alert"
      className={cn(
        'rounded-card border-destructive/30 bg-destructive/8 text-foreground flex gap-3 border p-4 text-sm',
        className,
      )}
    >
      <TriangleAlertIcon
        aria-hidden="true"
        className="text-destructive-on-tint mt-0.5 size-5 shrink-0"
      />
      <div className="space-y-1">
        <p className="font-medium">{copy.title}</p>
        <p className="text-muted-foreground">{copy.body}</p>
      </div>
    </div>
  )
}
