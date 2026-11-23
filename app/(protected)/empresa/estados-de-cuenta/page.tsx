import type { Metadata } from 'next'
import Link from 'next/link'
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
import { bogotaToday, periodLabel } from '@/lib/companies/period'
import { requireCompanyMember } from '@/lib/companies/server'
import { statementDisplayStatus } from '@/lib/companies/statement'
import {
  STATEMENT_STATUSES,
  STATEMENT_STATUS_LABELS,
  STATEMENT_STATUS_TONES,
  type StatementStatus,
} from '@/lib/companies/vocabulary'
import { formatCOP } from '@/lib/format'
import { formatDateCO } from '@/lib/format-date'
import { throwOnQueryError } from '@/lib/supabase/query-error'

export const metadata: Metadata = { title: 'Estados de cuenta' }
export const dynamic = 'force-dynamic'

const date = (value: string) => formatDateCO(new Date(`${value}T12:00:00`))

export default async function CompanyStatementsPage() {
  const { budget, supabase } = await requireCompanyMember(
    '/empresa/estados-de-cuenta',
    { admin: true },
  )
  const { data, error } = await supabase
    .from('company_statements')
    .select('id, period, issued_on, due_on, total, status, paid_at')
    .eq('company_id', budget.companyId)
    .neq('status', 'void')
    .order('period', { ascending: false })
    .limit(36)
  throwOnQueryError(error, 'company statements')
  const today = bogotaToday()
  const statements = (data ?? []).map((row) => {
    const status = (STATEMENT_STATUSES as readonly string[]).includes(
      row.status,
    )
      ? (row.status as StatementStatus)
      : 'issued'
    return {
      ...row,
      total: Number(row.total),
      display: statementDisplayStatus(
        { status, total: Number(row.total), due_on: row.due_on },
        today,
      ),
    }
  })

  return (
    <div className="space-y-6">
      <header className="space-y-1">
        <h1 className="text-h1 font-display font-semibold">
          Estados de cuenta
        </h1>
        <p className="text-muted-foreground max-w-2xl text-sm text-pretty">
          Uno por mes con todos los pedidos entregados de tu equipo. Se paga
          dentro del plazo acordado; un estado de cuenta vencido pausa la cuenta
          hasta que se pague.
        </p>
      </header>

      {statements.length === 0 ? (
        <EmptyState
          illustration="table"
          title="Todavía no hay estados de cuenta"
          description="El primero llega al cerrar el mes en que tu equipo haga su primer pedido."
        />
      ) : (
        <div className="rounded-card bg-card shadow-1 overflow-x-auto">
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead>Mes</TableHead>
                <TableHead>Emitido</TableHead>
                <TableHead>Vence</TableHead>
                <TableHead>Estado</TableHead>
                <TableHead className="text-right">Total</TableHead>
                <TableHead className="text-right">
                  <span className="sr-only">Detalle</span>
                </TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {statements.map((statement) => (
                <TableRow key={statement.id}>
                  <TableCell className="font-medium capitalize">
                    {periodLabel(statement.period)}
                  </TableCell>
                  <TableCell>{date(statement.issued_on)}</TableCell>
                  <TableCell>{date(statement.due_on)}</TableCell>
                  <TableCell>
                    <StatusBadge
                      label={STATEMENT_STATUS_LABELS[statement.display]}
                      tone={STATEMENT_STATUS_TONES[statement.display]}
                    />
                  </TableCell>
                  <TableCell className="text-right font-semibold tabular-nums">
                    {formatCOP(statement.total)}
                  </TableCell>
                  <TableCell className="text-right">
                    <Link
                      href={`/empresa/estados-de-cuenta/${statement.id}`}
                      className="text-primary-on-tint inline-flex min-h-11 items-center text-sm font-medium underline underline-offset-2"
                    >
                      Ver e imprimir
                      <span className="sr-only">
                        {' '}
                        el estado de cuenta de {periodLabel(statement.period)}
                      </span>
                    </Link>
                  </TableCell>
                </TableRow>
              ))}
            </TableBody>
          </Table>
        </div>
      )}
    </div>
  )
}
