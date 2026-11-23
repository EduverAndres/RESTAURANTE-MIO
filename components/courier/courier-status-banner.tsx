import { AlertTriangleIcon, CheckCircle2Icon, ClockIcon } from 'lucide-react'
import Link from 'next/link'
import {
  courierBlockReason,
  expiringDocuments,
  type CourierProfileFacts,
} from '@/lib/couriers/profile'
import { formatDateCO } from '@/lib/format-date'
import { cn } from '@/lib/utils'

const DOCUMENT_LABELS = { license: 'la licencia', soat: 'el SOAT' } as const

/**
 * The courier's standing, above the pool: why it is closed, or which paper
 * expires soon. Nothing at all when everything is in order and current.
 */
export function CourierStatusBanner({
  profile,
  today,
  linkToProfile = true,
}: {
  profile: Pick<
    CourierProfileFacts,
    'status' | 'vehicle_type' | 'license_expires_on' | 'soat_expires_on'
  > | null
  today: string
  linkToProfile?: boolean
}) {
  const blocked = courierBlockReason(profile, today)
  const expiring = profile ? expiringDocuments(profile, today) : []
  if (!blocked && expiring.length === 0) return null

  const reviewing = profile?.status === 'pending'
  const Icon = blocked
    ? reviewing
      ? ClockIcon
      : AlertTriangleIcon
    : CheckCircle2Icon

  return (
    <div
      role="status"
      className={cn(
        'rounded-card flex gap-3 border p-4 text-sm',
        blocked && !reviewing
          ? 'border-destructive/40 bg-destructive/10'
          : 'border-accent/40 bg-accent/10',
      )}
    >
      <Icon
        aria-hidden="true"
        className={cn(
          'mt-0.5 size-5 shrink-0',
          blocked && !reviewing ? 'text-destructive' : 'text-accent-strong',
        )}
      />
      <div className="space-y-1">
        <p className="text-foreground font-medium">
          {blocked ??
            expiring
              .map(
                (doc) =>
                  `Vence ${DOCUMENT_LABELS[doc.document]} el ${formatDateCO(new Date(`${doc.expiresOn}T00:00:00`))}`,
              )
              .join(' · ')}
        </p>
        {linkToProfile && profile?.status !== 'suspended' ? (
          <Link
            href="/courier/perfil"
            className="text-primary-on-tint font-medium underline underline-offset-2"
          >
            {profile ? 'Ir a mi perfil' : 'Completar mi perfil'}
          </Link>
        ) : null}
      </div>
    </div>
  )
}
