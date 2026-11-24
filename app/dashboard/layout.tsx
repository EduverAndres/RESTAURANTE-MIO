import type { Metadata } from 'next'
import { cookies } from 'next/headers'
import { BfcacheGuard } from '@/components/auth/bfcache-guard'
import { DashboardShell } from '@/components/dashboard/dashboard-shell'
import { requireRole } from '@/lib/auth'
import {
  ACTIVE_STORE_COOKIE,
  parseActiveStoreId,
  pickActiveStore,
} from '@/lib/dashboard/active-store'
import { getMerchantStores } from '@/lib/dashboard/store-context'
import { APP_NAME } from '@/lib/env'
import { pushConfigured } from '@/lib/env.server'
import { planHas, planOfStore } from '@/lib/plans'
import { createClient } from '@/lib/supabase/server'

/**
 * Whether the active store's plan includes reservations, and how many
 * upcoming requests wait for an answer (the pill in the navigation).
 */
async function reservationsNavState(store: {
  id: string
  plan: string | null
  founder_until: string | null
}): Promise<{ included: boolean; pending: number }> {
  const included = planHas(planOfStore(store), 'reservations')
  const supabase = await createClient()
  const { count } = await supabase
    .from('reservations')
    .select('id', { count: 'exact', head: true })
    .eq('store_id', store.id)
    .eq('status', 'pending')
    .gt('starts_at', new Date().toISOString())
  // A failed count only hides the pill; it never breaks the panel.
  return { included, pending: count ?? 0 }
}

export const metadata: Metadata = {
  title: {
    default: 'Panel del restaurante',
    template: `%s · Panel · ${APP_NAME}`,
  },
}

export default async function DashboardLayout({
  children,
}: Readonly<{ children: React.ReactNode }>) {
  const { user, profile, role } = await requireRole(
    ['merchant', 'admin'],
    '/dashboard',
  )
  // The layout never redirects to onboarding (that page lives under it);
  // pages call requireActiveStore for that.
  const stores = await getMerchantStores(user.id)
  const cookieStore = await cookies()
  const active = pickActiveStore(
    stores,
    parseActiveStoreId(cookieStore.get(ACTIVE_STORE_COOKIE)?.value),
  )
  const reservations = active ? await reservationsNavState(active) : undefined

  return (
    <>
      <BfcacheGuard />
      <DashboardShell
        variant="merchant"
        appName={APP_NAME}
        user={{
          id: user.id,
          name:
            profile?.full_name?.trim() ||
            user.email?.split('@')[0] ||
            'Tu cuenta',
          email: user.email ?? '',
          role,
        }}
        stores={stores.map(({ id, name, status }) => ({ id, name, status }))}
        activeStoreId={active?.id}
        pushEnabled={pushConfigured()}
        reservations={reservations}
      >
        {children}
      </DashboardShell>
    </>
  )
}
