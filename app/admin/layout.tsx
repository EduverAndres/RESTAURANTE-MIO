import type { Metadata } from 'next'
import { DashboardShell } from '@/components/dashboard/dashboard-shell'
import { requireRole } from '@/lib/auth'
import { APP_NAME } from '@/lib/env'

export const metadata: Metadata = {
  title: {
    default: 'Administración',
    template: `%s · Administración · ${APP_NAME}`,
  },
}

export default async function AdminLayout({
  children,
}: Readonly<{ children: React.ReactNode }>) {
  const { user, profile, role } = await requireRole(['admin'], '/admin')

  return (
    <DashboardShell
      variant="admin"
      appName={APP_NAME}
      user={{
        name:
          profile?.full_name?.trim() ||
          user.email?.split('@')[0] ||
          'Administrador',
        email: user.email ?? '',
        role,
      }}
    >
      {children}
    </DashboardShell>
  )
}
