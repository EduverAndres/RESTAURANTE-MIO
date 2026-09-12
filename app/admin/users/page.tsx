import type { Metadata } from 'next'
import { UserRoleSelect } from '@/components/admin/user-role-select'
import { EmptyState } from '@/components/ui/empty-state'
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from '@/components/ui/table'
import { requireRole } from '@/lib/auth'
import { formatDateCO } from '@/lib/format-date'
import { ROLE_LABELS } from '@/lib/orders/status'
import { createAdminClient } from '@/lib/supabase/admin'

export const metadata: Metadata = { title: 'Usuarios' }
export const dynamic = 'force-dynamic'

export default async function AdminUsersPage() {
  const { user: currentUser } = await requireRole(['admin'], '/admin/users')
  const admin = createAdminClient()

  const [{ data: profiles }, { data: authUsers }] = await Promise.all([
    admin
      .from('profiles')
      .select('id, full_name, phone, role, created_at')
      .order('created_at', { ascending: false }),
    admin.auth.admin.listUsers({ perPage: 1000 }),
  ])

  const emailById = new Map(
    (authUsers?.users ?? []).map((user) => [user.id, user.email ?? '—']),
  )

  return (
    <div className="mx-auto max-w-6xl space-y-6">
      <header className="space-y-1">
        <h1 className="font-display text-3xl font-semibold tracking-tight sm:text-4xl">
          Usuarios
        </h1>
        <p className="text-muted-foreground text-sm">
          Todas las personas registradas y su rol en la plataforma.
        </p>
      </header>

      {profiles && profiles.length > 0 ? (
        <div className="rounded-card border-border bg-card shadow-soft overflow-x-auto border">
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead>Nombre</TableHead>
                <TableHead>Correo</TableHead>
                <TableHead>Teléfono</TableHead>
                <TableHead>Rol</TableHead>
                <TableHead className="text-right">Registrado</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {profiles.map((profile) => (
                <TableRow key={profile.id}>
                  <TableCell className="font-medium">
                    {profile.full_name?.trim() || 'Sin nombre'}
                    {profile.id === currentUser.id ? (
                      <span className="text-muted-foreground ml-1.5 text-xs">
                        (tú)
                      </span>
                    ) : null}
                  </TableCell>
                  <TableCell className="text-muted-foreground">
                    {emailById.get(profile.id) ?? '—'}
                  </TableCell>
                  <TableCell className="text-muted-foreground">
                    {profile.phone ?? '—'}
                  </TableCell>
                  <TableCell>
                    <UserRoleSelect
                      userId={profile.id}
                      role={profile.role}
                      userName={profile.full_name?.trim() || 'este usuario'}
                      disabled={profile.id === currentUser.id}
                    />
                  </TableCell>
                  <TableCell className="text-muted-foreground text-right">
                    {formatDateCO(profile.created_at)}
                  </TableCell>
                </TableRow>
              ))}
            </TableBody>
          </Table>
        </div>
      ) : (
        <EmptyState
          title="No hay usuarios"
          description="Todavía no se ha registrado nadie."
        />
      )}
      <p className="text-muted-foreground text-xs">
        Roles: {Object.entries(ROLE_LABELS)
          .map(([, label]) => label)
          .join(', ')}
        .
      </p>
    </div>
  )
}
