import type { Metadata } from 'next'
import { cookies } from 'next/headers'
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

  return (
    <DashboardShell
      variant="merchant"
      appName={APP_NAME}
      user={{
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
    >
      {children}
    </DashboardShell>
  )
}
