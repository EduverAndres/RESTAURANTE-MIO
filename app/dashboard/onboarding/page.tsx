import type { Metadata } from 'next'
import { OnboardingWizard } from './onboarding-wizard'
import { requireRole } from '@/lib/auth'
import { getMerchantStores } from '@/lib/dashboard/store-context'

export const metadata: Metadata = { title: 'Crear tienda' }
export const dynamic = 'force-dynamic'

export default async function OnboardingPage() {
  const { user } = await requireRole(
    ['merchant', 'admin'],
    '/dashboard/onboarding',
  )
  const stores = await getMerchantStores(user.id)

  return (
    <div className="mx-auto max-w-2xl space-y-8">
      <header className="space-y-1">
        <h1 className="font-display text-3xl font-semibold tracking-tight sm:text-4xl">
          {stores.length > 0 ? 'Crear otra tienda' : 'Crea tu tienda'}
        </h1>
        <p className="text-muted-foreground text-sm">
          Tres pasos y tu carta estará lista para recibir pedidos. Podrás
          cambiar todo después desde el panel.
        </p>
      </header>
      <OnboardingWizard hasStores={stores.length > 0} />
    </div>
  )
}
