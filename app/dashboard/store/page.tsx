import type { Metadata } from 'next'
import { StoreAssetsCard } from './store-assets-card'
import { StoreForm } from './store-form'
import { StoreStatusCard } from './store-status-card'
import { requireActiveStoreRow } from '@/lib/dashboard/store-context'
import { scheduleToForm } from '@/lib/validations/store'

export const metadata: Metadata = { title: 'Tienda' }
export const dynamic = 'force-dynamic'

export default async function StoreSettingsPage() {
  const { store } = await requireActiveStoreRow('/dashboard/store')

  return (
    <div className="mx-auto max-w-5xl space-y-8">
      <header className="space-y-1">
        <h1 className="font-display text-3xl font-semibold tracking-tight sm:text-4xl">
          Tienda
        </h1>
        <p className="text-muted-foreground text-sm">
          Datos públicos, ubicación, entregas y horarios de {store.name}.
        </p>
      </header>

      <div className="grid gap-6 lg:grid-cols-[1fr_320px] lg:items-start">
        <StoreForm
          storeId={store.id}
          defaults={{
            name: store.name,
            slug: store.slug,
            category: store.category ?? '',
            description: store.description ?? '',
            whatsapp_phone: store.whatsapp_phone ?? '',
            address: store.address ?? '',
            lat: store.lat ?? Number.NaN,
            lng: store.lng ?? Number.NaN,
            delivery_radius_km: Number(store.delivery_radius_km),
            delivery_fee: Number(store.delivery_fee),
            min_order: Number(store.min_order),
            prep_time_min: store.prep_time_min,
          }}
          schedule={scheduleToForm(store.schedule)}
        />
        <div className="space-y-6">
          <StoreStatusCard
            storeId={store.id}
            slug={store.slug}
            status={store.status}
            isOpen={store.is_open}
          />
          <StoreAssetsCard
            storeId={store.id}
            logoUrl={store.logo_url}
            coverUrl={store.cover_url}
          />
        </div>
      </div>
    </div>
  )
}
