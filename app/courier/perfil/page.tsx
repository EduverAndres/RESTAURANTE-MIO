import type { Metadata } from 'next'
import { CourierProfileForm } from '@/components/courier/courier-profile-form'
import { CourierStatusBanner } from '@/components/courier/courier-status-banner'
import { StatusBadge } from '@/components/orders/order-status-badge'
import { requireRole } from '@/lib/auth'
import { bogotaToday, isCourierActive } from '@/lib/couriers/profile'
import { fetchOwnCourierProfile } from '@/lib/couriers/server'
import {
  COURIER_STATUS_LABELS,
  COURIER_STATUS_TONES,
} from '@/lib/couriers/vocabulary'
import { createClient } from '@/lib/supabase/server'

export const metadata: Metadata = { title: 'Mi perfil' }
export const dynamic = 'force-dynamic'

/**
 * Where a courier puts their vehicle and papers on file. Nothing in the order
 * pool opens until an admin approves this profile.
 */
export default async function CourierProfilePage() {
  const { user } = await requireRole(['courier', 'admin'], '/courier/perfil')
  const supabase = await createClient()
  const profile = await fetchOwnCourierProfile(supabase, user.id)
  const today = bogotaToday()

  return (
    <div className="mx-auto max-w-2xl space-y-6">
      <header className="space-y-2">
        <h1 className="font-display text-3xl font-semibold tracking-tight sm:text-4xl">
          Mi perfil de domiciliario
        </h1>
        <p className="text-muted-foreground text-sm text-pretty">
          Con estos datos verificamos quién entrega. Cuando el equipo de
          Cerquita apruebe tu perfil, se abre la bolsa de pedidos. Tus datos
          solo los ve el equipo de Cerquita.
        </p>
        {profile ? (
          <div className="flex flex-wrap items-center gap-2">
            <StatusBadge
              label={COURIER_STATUS_LABELS[profile.status]}
              tone={COURIER_STATUS_TONES[profile.status]}
            />
            {profile.status_note ? (
              <span className="text-muted-foreground text-sm">
                {profile.status_note}
              </span>
            ) : null}
          </div>
        ) : null}
      </header>

      <CourierStatusBanner
        profile={profile}
        today={today}
        linkToProfile={false}
      />

      <section className="rounded-card bg-card shadow-1 p-card">
        <CourierProfileForm
          approved={isCourierActive(profile, today)}
          defaults={{
            vehicleType: profile?.vehicle_type ?? '',
            plate: profile?.plate ?? '',
            documentNumber: profile?.document_number ?? '',
            city: profile?.city ?? 'Barranquilla',
            zone: profile?.zone ?? '',
            licenseExpiresOn: profile?.license_expires_on ?? '',
            soatExpiresOn: profile?.soat_expires_on ?? '',
          }}
        />
      </section>
    </div>
  )
}
