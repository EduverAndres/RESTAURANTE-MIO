import type { Metadata } from 'next'
import Link from 'next/link'
import { CourierLedgerEntryDialog } from '@/components/admin/courier-ledger-entry-dialog'
import { CourierReviewActions } from '@/components/admin/courier-review-actions'
import { StatusBadge } from '@/components/orders/order-status-badge'
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
import {
  bogotaToday,
  expiringDocuments,
  isCourierActive,
} from '@/lib/couriers/profile'
import { toCourierProfile, type CourierProfile } from '@/lib/couriers/server'
import {
  COURIER_STATUS_LABELS,
  COURIER_STATUS_TONES,
  VEHICLE_LABELS,
  type CourierStatus,
} from '@/lib/couriers/vocabulary'
import { ledgerBalance } from '@/lib/couriers/ledger'
import { formatCOP } from '@/lib/format'
import { formatDateCO } from '@/lib/format-date'
import { createAdminClient } from '@/lib/supabase/admin'
import { throwOnQueryError } from '@/lib/supabase/query-error'

export const metadata: Metadata = { title: 'Domiciliarios' }
export const dynamic = 'force-dynamic'

/** Review order: whoever is waiting first, then the rest. */
const STATUS_ORDER: Record<CourierStatus | 'none', number> = {
  pending: 0,
  none: 1,
  approved: 2,
  suspended: 3,
}

const date = (value: string | null) =>
  value ? formatDateCO(new Date(`${value}T00:00:00`)) : '—'

/**
 * Every courier account and its review. Approving opens the order pool to
 * that courier; the pool closes again by itself when a licence or SOAT
 * expires.
 */
export default async function AdminCouriersPage() {
  await requireRole(['admin'], '/admin/domiciliarios')
  const admin = createAdminClient()
  const [
    { data: couriers, error: couriersError },
    { data: profiles, error: profilesError },
    { data: openEntries, error: entriesError },
    { data: openPayouts, error: payoutsError },
  ] = await Promise.all([
    admin
      .from('profiles')
      .select('id, full_name, phone, created_at')
      .eq('role', 'courier')
      .order('created_at', { ascending: false })
      .limit(500),
    admin.from('courier_profiles').select('*').limit(500),
    // What each courier owes or is owed right now: unsettled ledger entries
    // plus payouts not paid yet (same as `courier_cash_balance` in SQL).
    admin
      .from('courier_ledger')
      .select('courier_id, kind, earnings, cash_collected, amount')
      .is('settled_in_payout_id', null),
    admin
      .from('courier_payouts')
      .select('courier_id, net')
      .eq('status', 'pending')
      .is('carried_into_payout_id', null),
  ])
  throwOnQueryError(couriersError, 'admin couriers')
  throwOnQueryError(profilesError, 'admin courier profiles')
  throwOnQueryError(entriesError, 'admin courier ledger')
  throwOnQueryError(payoutsError, 'admin courier open payouts')

  const balanceOf = new Map<string, number>()
  for (const entry of openEntries ?? []) {
    const balance = ledgerBalance([
      {
        kind: entry.kind as 'delivery' | 'deposit' | 'adjustment',
        earnings: Number(entry.earnings),
        cash_collected: Number(entry.cash_collected),
        amount: Number(entry.amount),
      },
    ])
    balanceOf.set(
      entry.courier_id,
      (balanceOf.get(entry.courier_id) ?? 0) + balance,
    )
  }
  for (const payout of openPayouts ?? []) {
    balanceOf.set(
      payout.courier_id,
      (balanceOf.get(payout.courier_id) ?? 0) + Number(payout.net),
    )
  }

  const byUser = new Map<string, CourierProfile>(
    (profiles ?? []).map((row) => [row.user_id, toCourierProfile(row)]),
  )
  const today = bogotaToday()
  const rows = (couriers ?? [])
    .map((courier) => ({ courier, profile: byUser.get(courier.id) ?? null }))
    .sort(
      (a, b) =>
        STATUS_ORDER[a.profile?.status ?? 'none'] -
        STATUS_ORDER[b.profile?.status ?? 'none'],
    )
  const waiting = rows.filter((row) => row.profile?.status === 'pending').length

  return (
    <div className="mx-auto max-w-6xl space-y-6">
      <header className="space-y-1">
        <h1 className="text-h1 font-display font-semibold">Domiciliarios</h1>
        <p className="text-muted-foreground text-sm">
          Solo un domiciliario aprobado y con sus documentos al día ve la bolsa
          de pedidos.{' '}
          {waiting > 0
            ? `${waiting} perfil${waiting === 1 ? '' : 'es'} esperando revisión.`
            : 'No hay perfiles esperando revisión.'}{' '}
          <Link
            href="/admin/domiciliarios/liquidaciones"
            className="text-primary-on-tint font-medium underline underline-offset-2"
          >
            Ver liquidaciones de domiciliarios
          </Link>
        </p>
      </header>

      {rows.length === 0 ? (
        <EmptyState
          title="Todavía no hay domiciliarios"
          description="Aparecerán aquí cuando alguien se registre como domiciliario."
        />
      ) : (
        <div className="rounded-card bg-card shadow-1 overflow-x-auto">
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead>Domiciliario</TableHead>
                <TableHead>Estado</TableHead>
                <TableHead>Vehículo</TableHead>
                <TableHead>Documento</TableHead>
                <TableHead>Licencia</TableHead>
                <TableHead>SOAT</TableHead>
                <TableHead className="text-right">Saldo</TableHead>
                <TableHead className="text-right">Revisión</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {rows.map(({ courier, profile }) => {
                const name = courier.full_name?.trim() || 'Sin nombre'
                const expiring = profile
                  ? expiringDocuments(profile, today)
                  : []
                const lapsed =
                  profile?.status === 'approved' &&
                  !isCourierActive(profile, today)
                return (
                  <TableRow key={courier.id}>
                    <TableCell>
                      <span className="block font-medium">{name}</span>
                      <span className="text-muted-foreground text-xs">
                        {courier.phone ?? 'Sin teléfono'}
                        {profile?.zone ? ` · ${profile.zone}` : ''}
                      </span>
                    </TableCell>
                    <TableCell>
                      {profile ? (
                        <StatusBadge
                          label={COURIER_STATUS_LABELS[profile.status]}
                          tone={COURIER_STATUS_TONES[profile.status]}
                        />
                      ) : (
                        <StatusBadge label="Sin perfil" tone="neutral" />
                      )}
                      {lapsed ? (
                        <span className="text-destructive mt-1 block text-xs">
                          Documentos vencidos: no ve la bolsa
                        </span>
                      ) : null}
                      {profile?.status_note ? (
                        <span className="text-muted-foreground mt-1 block max-w-48 text-xs whitespace-normal">
                          {profile.status_note}
                        </span>
                      ) : null}
                    </TableCell>
                    <TableCell>
                      {profile?.vehicle_type
                        ? VEHICLE_LABELS[profile.vehicle_type]
                        : '—'}
                      {profile?.plate ? (
                        <span className="text-muted-foreground block font-mono text-xs">
                          {profile.plate}
                        </span>
                      ) : null}
                    </TableCell>
                    <TableCell className="font-mono text-sm">
                      {profile?.document_number ?? '—'}
                    </TableCell>
                    <TableCell
                      className={
                        expiring.some((doc) => doc.document === 'license')
                          ? 'text-destructive'
                          : undefined
                      }
                    >
                      {date(profile?.license_expires_on ?? null)}
                    </TableCell>
                    <TableCell
                      className={
                        expiring.some((doc) => doc.document === 'soat')
                          ? 'text-destructive'
                          : undefined
                      }
                    >
                      {date(profile?.soat_expires_on ?? null)}
                    </TableCell>
                    <TableCell className="text-right whitespace-nowrap">
                      {(() => {
                        const balance = balanceOf.get(courier.id) ?? 0
                        return (
                          <div className="flex flex-col items-end gap-1">
                            <span
                              className={
                                balance < 0
                                  ? 'text-destructive font-medium tabular-nums'
                                  : 'tabular-nums'
                              }
                            >
                              {balance < 0
                                ? `Debe ${formatCOP(-balance)}`
                                : balance > 0
                                  ? `Se le debe ${formatCOP(balance)}`
                                  : formatCOP(0)}
                            </span>
                            {profile ? (
                              <CourierLedgerEntryDialog
                                courierId={courier.id}
                                name={name}
                                owed={Math.max(0, -balance)}
                              />
                            ) : null}
                          </div>
                        )
                      })()}
                    </TableCell>
                    <TableCell className="text-right">
                      <CourierReviewActions
                        userId={courier.id}
                        name={name}
                        status={profile?.status ?? null}
                        hasProfile={profile !== null}
                      />
                    </TableCell>
                  </TableRow>
                )
              })}
            </TableBody>
          </Table>
        </div>
      )}
    </div>
  )
}
