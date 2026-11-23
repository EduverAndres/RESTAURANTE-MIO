import type { Metadata } from 'next'
import Link from 'next/link'
import {
  GenerateStatementsForm,
  MarkStatementPaidDialog,
  VoidStatementDialog,
} from '@/components/admin/company-statement-actions'
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
  periodLabel,
  periodTitle,
  recentClosedPeriods,
} from '@/lib/companies/period'
import { statementDisplayStatus } from '@/lib/companies/statement'
import {
  STATEMENT_STATUSES,
  STATEMENT_STATUS_LABELS,
  STATEMENT_STATUS_TONES,
  type StatementStatus,
} from '@/lib/companies/vocabulary'
import { formatCOP } from '@/lib/format'
import { formatDateCO } from '@/lib/format-date'
import { createAdminClient } from '@/lib/supabase/admin'
import { throwOnQueryError } from '@/lib/supabase/query-error'

export const metadata: Metadata = { title: 'Estados de cuenta de empresas' }
export const dynamic = 'force-dynamic'

const date = (value: string) => formatDateCO(new Date(`${value}T12:00:00`))

/**
 * Monthly statements of every company: generate a closed month, record a
 * payment, annul a wrong one. Like merchant payouts, but money coming in.
 */
export default async function AdminCompanyStatementsPage() {
  await requireRole(['admin'], '/admin/companies/statements')
  const { data, error } = await createAdminClient()
    .from('company_statements')
    .select(
      'id, company_id, period, legal_name, issued_on, due_on, total, status, paid_at, payment_ref, void_reason, company_statement_lines(count)',
    )
    .order('period', { ascending: false })
    .order('created_at', { ascending: false })
    .limit(300)
  throwOnQueryError(error, 'admin company statements')

  const today = bogotaToday()
  const rows = (data ?? []).map((row) => {
    const status = (STATEMENT_STATUSES as readonly string[]).includes(
      row.status,
    )
      ? (row.status as StatementStatus)
      : 'issued'
    return {
      ...row,
      total: Number(row.total),
      status,
      display: statementDisplayStatus(
        { status, total: Number(row.total), due_on: row.due_on },
        today,
      ),
      lines: row.company_statement_lines?.[0]?.count ?? 0,
    }
  })
  const due = rows
    .filter((row) => row.status === 'issued' || row.status === 'overdue')
    .reduce((sum, row) => sum + Math.max(0, row.total), 0)

  return (
    <div className="mx-auto max-w-6xl space-y-6">
      <header className="space-y-1">
        <h1 className="text-h1 font-display font-semibold">
          Estados de cuenta de empresas
        </h1>
        <p className="text-muted-foreground text-sm">
          Por cobrar: <span className="font-semibold">{formatCOP(due)}</span>.{' '}
          <Link
            href="/admin/companies"
            className="text-primary-on-tint font-medium underline underline-offset-2"
          >
            Ver empresas
          </Link>
        </p>
      </header>

      <section className="rounded-card bg-card shadow-1 p-card space-y-3">
        <h2 className="font-display text-xl font-semibold">Generar</h2>
        <p className="text-muted-foreground text-sm text-pretty">
          Cada empresa recibe un estado de cuenta con los pedidos entregados del
          mes (y los de meses anteriores que se entregaron tarde), más los
          abonos de reembolsos. Volver a generar un mes no duplica nada.
        </p>
        <GenerateStatementsForm periods={recentClosedPeriods(new Date(), 6)} />
      </section>

      {rows.length === 0 ? (
        <EmptyState
          title="Todavía no hay estados de cuenta"
          description="Genera el primero cuando cierre un mes con pedidos de empresas."
        />
      ) : (
        <div className="rounded-card bg-card shadow-1 overflow-x-auto">
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead>Empresa</TableHead>
                <TableHead>Mes</TableHead>
                <TableHead>Vence</TableHead>
                <TableHead>Estado</TableHead>
                <TableHead className="text-right">Total</TableHead>
                <TableHead className="text-right">Acciones</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {rows.map((row) => {
                const label = `${row.legal_name} · ${periodLabel(row.period)}`
                const open = row.status === 'issued' || row.status === 'overdue'
                return (
                  <TableRow key={row.id}>
                    <TableCell>
                      <span className="block font-medium">
                        {row.legal_name}
                      </span>
                      <span className="text-muted-foreground text-xs">
                        {row.lines} línea{row.lines === 1 ? '' : 's'}
                      </span>
                    </TableCell>
                    <TableCell>{periodTitle(row.period)}</TableCell>
                    <TableCell>{date(row.due_on)}</TableCell>
                    <TableCell>
                      <StatusBadge
                        label={STATEMENT_STATUS_LABELS[row.display]}
                        tone={STATEMENT_STATUS_TONES[row.display]}
                      />
                      {row.payment_ref ? (
                        <span className="text-muted-foreground mt-1 block text-xs">
                          Ref. {row.payment_ref}
                        </span>
                      ) : null}
                      {row.void_reason ? (
                        <span className="text-muted-foreground mt-1 block max-w-48 text-xs whitespace-normal">
                          {row.void_reason}
                        </span>
                      ) : null}
                    </TableCell>
                    <TableCell className="text-right font-semibold tabular-nums">
                      {formatCOP(row.total)}
                    </TableCell>
                    <TableCell className="text-right whitespace-nowrap">
                      {open ? (
                        <>
                          <MarkStatementPaidDialog
                            statementId={row.id}
                            label={label}
                          />
                          <VoidStatementDialog
                            statementId={row.id}
                            label={label}
                          />
                        </>
                      ) : (
                        <span className="text-muted-foreground text-xs">—</span>
                      )}
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
