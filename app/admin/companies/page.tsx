import type { Metadata } from 'next'
import Link from 'next/link'
import { CompanyReviewActions } from '@/components/admin/company-review-actions'
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
import { formatNit } from '@/lib/companies/nit'
import {
  COMPANY_STATUSES,
  COMPANY_STATUS_LABELS,
  COMPANY_STATUS_TONES,
  companyDisplayName,
  type CompanyStatus,
} from '@/lib/companies/vocabulary'
import { formatCOP } from '@/lib/format'
import { formatDateCO } from '@/lib/format-date'
import { createAdminClient } from '@/lib/supabase/admin'
import { throwOnQueryError } from '@/lib/supabase/query-error'

export const metadata: Metadata = { title: 'Empresas' }
export const dynamic = 'force-dynamic'

/** Review order: whoever is waiting first. */
const STATUS_ORDER: Record<CompanyStatus, number> = {
  pending: 0,
  active: 1,
  suspended: 2,
}

/**
 * Company accounts and their credit. Approving sets the credit line, the
 * payment terms and the tip cap; from then on the company's members can pay
 * with it, within their budgets.
 */
export default async function AdminCompaniesPage() {
  await requireRole(['admin'], '/admin/companies')
  const admin = createAdminClient()
  const [{ data: companies, error }, { data: members, error: membersError }] =
    await Promise.all([
      admin
        .from('companies')
        .select('*')
        .order('created_at', { ascending: false })
        .limit(500),
      admin
        .from('company_members')
        .select('company_id')
        .eq('active', true)
        .limit(10_000),
    ])
  throwOnQueryError(error, 'admin companies')
  throwOnQueryError(membersError, 'admin company members')

  const rows = companies ?? []
  const used = await Promise.all(
    rows.map(async (company) => {
      const { data } = await admin.rpc('company_credit_used', {
        p_company_id: company.id,
      })
      return [company.id, Number(data ?? 0)] as const
    }),
  )
  const usedBy = new Map(used)
  const teamBy = new Map<string, number>()
  for (const member of members ?? [])
    teamBy.set(member.company_id, (teamBy.get(member.company_id) ?? 0) + 1)

  const sorted = rows
    .map((company) => ({
      ...company,
      status: (COMPANY_STATUSES as readonly string[]).includes(company.status)
        ? (company.status as CompanyStatus)
        : 'pending',
    }))
    .sort((a, b) => STATUS_ORDER[a.status] - STATUS_ORDER[b.status])
  const waiting = sorted.filter(
    (company) => company.status === 'pending',
  ).length

  return (
    <div className="mx-auto max-w-6xl space-y-6">
      <header className="space-y-1">
        <h1 className="text-h1 font-display font-semibold">Empresas</h1>
        <p className="text-muted-foreground text-sm">
          {waiting > 0
            ? `${waiting} empresa${waiting === 1 ? '' : 's'} esperando aprobación.`
            : 'No hay empresas esperando aprobación.'}{' '}
          <Link
            href="/admin/companies/statements"
            className="text-primary-on-tint font-medium underline underline-offset-2"
          >
            Ver estados de cuenta
          </Link>
        </p>
      </header>

      {sorted.length === 0 ? (
        <EmptyState
          title="Todavía no hay empresas"
          description="Aparecerán aquí cuando alguien registre una desde /empresas."
        />
      ) : (
        <div className="rounded-card bg-card shadow-1 overflow-x-auto">
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead>Empresa</TableHead>
                <TableHead>Estado</TableHead>
                <TableHead>Contacto</TableHead>
                <TableHead className="text-right">Equipo</TableHead>
                <TableHead className="text-right">Cupo usado</TableHead>
                <TableHead>Condiciones</TableHead>
                <TableHead className="text-right">Revisión</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {sorted.map((company) => {
                const name = companyDisplayName(company)
                const limit = Number(company.credit_limit)
                return (
                  <TableRow key={company.id}>
                    <TableCell>
                      <span className="block font-medium">{name}</span>
                      <span className="text-muted-foreground block text-xs">
                        {company.legal_name} · NIT{' '}
                        {formatNit(company.nit, company.dv)}
                      </span>
                      <span className="text-muted-foreground block text-xs">
                        Registrada el {formatDateCO(company.created_at)}
                      </span>
                    </TableCell>
                    <TableCell>
                      <StatusBadge
                        label={COMPANY_STATUS_LABELS[company.status]}
                        tone={COMPANY_STATUS_TONES[company.status]}
                      />
                      {company.status_note ? (
                        <span className="text-muted-foreground mt-1 block max-w-48 text-xs whitespace-normal">
                          {company.status_note}
                        </span>
                      ) : null}
                    </TableCell>
                    <TableCell className="text-sm">
                      <span className="block">{company.contact_name}</span>
                      <span className="text-muted-foreground block text-xs">
                        {company.contact_phone} · {company.billing_email}
                      </span>
                    </TableCell>
                    <TableCell className="text-right tabular-nums">
                      {teamBy.get(company.id) ?? 0}
                    </TableCell>
                    <TableCell className="text-right whitespace-nowrap tabular-nums">
                      {formatCOP(usedBy.get(company.id) ?? 0)}
                      <span className="text-muted-foreground block text-xs">
                        de {formatCOP(limit)}
                      </span>
                    </TableCell>
                    <TableCell className="text-sm whitespace-nowrap">
                      {company.payment_terms_days} días · propina hasta{' '}
                      {company.max_tip_pct} %
                    </TableCell>
                    <TableCell className="text-right">
                      <CompanyReviewActions
                        companyId={company.id}
                        name={name}
                        status={company.status}
                        terms={{
                          creditLimit: limit,
                          paymentTermsDays: company.payment_terms_days,
                          maxTipPct: company.max_tip_pct,
                        }}
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
