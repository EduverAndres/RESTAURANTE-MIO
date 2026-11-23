import { ChevronLeftIcon } from 'lucide-react'
import type { Metadata } from 'next'
import Link from 'next/link'
import { notFound } from 'next/navigation'
import { PrintButton } from '@/components/companies/print-button'
import { StatusBadge } from '@/components/orders/order-status-badge'
import { formatNit } from '@/lib/companies/nit'
import { bogotaToday, periodLabel } from '@/lib/companies/period'
import { requireCompanyMember } from '@/lib/companies/server'
import { statementDisplayStatus } from '@/lib/companies/statement'
import {
  STATEMENT_LINE_LABELS,
  STATEMENT_STATUSES,
  STATEMENT_STATUS_LABELS,
  STATEMENT_STATUS_TONES,
  type StatementLineKind,
  type StatementStatus,
} from '@/lib/companies/vocabulary'
import { isUuid } from '@/lib/dashboard/active-store'
import { formatCOP } from '@/lib/format'
import { formatDateCO } from '@/lib/format-date'
import { COMPANY } from '@/lib/legal/company'
import { supportWhatsAppUrl } from '@/lib/marketplace/support'
import { throwOnQueryError } from '@/lib/supabase/query-error'

export const metadata: Metadata = { title: 'Estado de cuenta' }
export const dynamic = 'force-dynamic'

const date = (value: string) => formatDateCO(new Date(`${value}T12:00:00`))

/**
 * One statement, laid out to print or save as PDF: who bills whom, the
 * month, the due date, every order and every credit. The panel's navigation
 * and buttons hide in print.
 */
export default async function CompanyStatementPage({
  params,
}: {
  params: Promise<{ id: string }>
}) {
  const { id } = await params
  if (!isUuid(id)) notFound()
  const { budget, supabase } = await requireCompanyMember(
    `/empresa/estados-de-cuenta/${id}`,
    { admin: true },
  )
  const [{ data: statement, error }, { data: lines, error: linesError }] =
    await Promise.all([
      supabase
        .from('company_statements')
        .select('*')
        .eq('id', id)
        .eq('company_id', budget.companyId)
        .maybeSingle(),
      supabase
        .from('company_statement_lines')
        .select(
          'id, kind, amount, short_code, store_name, member_name, corporate_reference, ordered_at',
        )
        .eq('statement_id', id)
        .order('ordered_at', { ascending: true })
        .limit(2000),
    ])
  throwOnQueryError(error, 'company statement')
  throwOnQueryError(linesError, 'company statement lines')
  if (!statement) notFound()

  const status = (STATEMENT_STATUSES as readonly string[]).includes(
    statement.status,
  )
    ? (statement.status as StatementStatus)
    : 'issued'
  const display = statementDisplayStatus(
    { status, total: Number(statement.total), due_on: statement.due_on },
    bogotaToday(),
  )
  const charges = (lines ?? []).filter((line) => line.kind === 'charge')
  const credits = (lines ?? []).filter((line) => line.kind === 'refund')
  const sum = (rows: typeof charges) =>
    rows.reduce((total, line) => total + Number(line.amount), 0)
  const reference = `EC-${statement.period.slice(0, 7)}-${statement.nit}`
  const support = supportWhatsAppUrl(
    `Hola, quiero pagar el estado de cuenta ${reference}.`,
  )

  return (
    <div className="space-y-6">
      <div className="flex flex-wrap items-center justify-between gap-3 print:hidden">
        <Link
          href="/empresa/estados-de-cuenta"
          className="text-muted-foreground hover:text-foreground inline-flex min-h-11 items-center gap-1 text-sm"
        >
          <ChevronLeftIcon aria-hidden="true" className="size-4" />
          Estados de cuenta
        </Link>
        <PrintButton />
      </div>

      <article className="rounded-card bg-card shadow-1 p-card space-y-8 print:rounded-none print:p-0 print:shadow-none">
        <header className="flex flex-wrap items-start justify-between gap-6">
          <div className="space-y-1">
            <p className="text-primary-on-tint text-xs font-semibold tracking-wide uppercase">
              Estado de cuenta
            </p>
            <h1 className="text-h2 font-display font-semibold capitalize">
              {periodLabel(statement.period)}
            </h1>
            <p className="text-muted-foreground font-mono text-xs">
              Ref. {reference}
            </p>
          </div>
          <div className="text-right text-sm">
            <p className="font-semibold">{COMPANY.brand}</p>
            <p className="text-muted-foreground">{COMPANY.legalName}</p>
            <p className="text-muted-foreground">NIT {COMPANY.nit}</p>
          </div>
        </header>

        <section className="grid gap-6 sm:grid-cols-2">
          <div className="space-y-1 text-sm">
            <h2 className="text-muted-foreground text-xs font-semibold tracking-wide uppercase">
              Cliente
            </h2>
            <p className="font-semibold">{statement.legal_name}</p>
            <p>NIT {formatNit(statement.nit, statement.dv)}</p>
          </div>
          <dl className="grid grid-cols-2 gap-3 text-sm">
            <div>
              <dt className="text-muted-foreground">Emitido</dt>
              <dd className="font-medium">{date(statement.issued_on)}</dd>
            </div>
            <div>
              <dt className="text-muted-foreground">Vence</dt>
              <dd className="font-medium">{date(statement.due_on)}</dd>
            </div>
            <div>
              <dt className="text-muted-foreground">Estado</dt>
              <dd>
                <StatusBadge
                  label={STATEMENT_STATUS_LABELS[display]}
                  tone={STATEMENT_STATUS_TONES[display]}
                />
              </dd>
            </div>
            <div>
              <dt className="text-muted-foreground">Total a pagar</dt>
              <dd className="font-display text-xl font-semibold tabular-nums">
                {formatCOP(Number(statement.total))}
              </dd>
            </div>
          </dl>
        </section>

        <section aria-labelledby="detalle-title" className="space-y-3">
          <h2 id="detalle-title" className="font-display text-xl font-semibold">
            Detalle
          </h2>
          <div className="overflow-x-auto">
            <table className="w-full min-w-[40rem] text-sm">
              <thead>
                <tr className="border-border text-muted-foreground border-b text-left text-xs">
                  <th scope="col" className="py-2 pr-3 font-medium">
                    Fecha
                  </th>
                  <th scope="col" className="py-2 pr-3 font-medium">
                    Pedido
                  </th>
                  <th scope="col" className="py-2 pr-3 font-medium">
                    Persona
                  </th>
                  <th scope="col" className="py-2 pr-3 font-medium">
                    Restaurante
                  </th>
                  <th scope="col" className="py-2 pr-3 font-medium">
                    Motivo
                  </th>
                  <th scope="col" className="py-2 text-right font-medium">
                    Valor
                  </th>
                </tr>
              </thead>
              <tbody className="divide-border divide-y">
                {(lines ?? []).map((line) => (
                  <tr key={line.id}>
                    <td className="py-2 pr-3 whitespace-nowrap">
                      {formatDateCO(line.ordered_at)}
                    </td>
                    <td className="py-2 pr-3">
                      <span className="font-mono">#{line.short_code}</span>
                      {line.kind === 'refund' ? (
                        <span className="text-success-on-tint block text-xs">
                          {
                            STATEMENT_LINE_LABELS[
                              line.kind as StatementLineKind
                            ]
                          }
                        </span>
                      ) : null}
                    </td>
                    <td className="py-2 pr-3">{line.member_name ?? '—'}</td>
                    <td className="py-2 pr-3">{line.store_name}</td>
                    <td className="text-muted-foreground py-2 pr-3">
                      {line.corporate_reference ?? '—'}
                    </td>
                    <td className="py-2 text-right tabular-nums">
                      {formatCOP(Number(line.amount))}
                    </td>
                  </tr>
                ))}
              </tbody>
              <tfoot className="text-sm">
                <tr className="border-border border-t">
                  <th
                    scope="row"
                    colSpan={5}
                    className="py-2 pr-3 text-left font-normal"
                  >
                    Pedidos ({charges.length})
                  </th>
                  <td className="py-2 text-right tabular-nums">
                    {formatCOP(sum(charges))}
                  </td>
                </tr>
                {credits.length > 0 ? (
                  <tr>
                    <th
                      scope="row"
                      colSpan={5}
                      className="py-2 pr-3 text-left font-normal"
                    >
                      Abonos por reembolsos ({credits.length})
                    </th>
                    <td className="py-2 text-right tabular-nums">
                      {formatCOP(sum(credits))}
                    </td>
                  </tr>
                ) : null}
                <tr className="border-border border-t">
                  <th
                    scope="row"
                    colSpan={5}
                    className="py-2 pr-3 text-left font-semibold"
                  >
                    Total
                  </th>
                  <td className="py-2 text-right font-semibold tabular-nums">
                    {formatCOP(Number(statement.total))}
                  </td>
                </tr>
              </tfoot>
            </table>
          </div>
        </section>

        <footer className="text-muted-foreground space-y-1 text-xs text-pretty">
          <p>
            Cada pedido lo factura el restaurante que lo vendió, a nombre de{' '}
            {statement.legal_name}. Este estado de cuenta reúne lo que tu equipo
            cargó a la cuenta de la empresa en el mes y no reemplaza esas
            facturas.
          </p>
          <p>
            Paga antes del {date(statement.due_on)} con la referencia{' '}
            <span className="font-mono">{reference}</span>.{' '}
            {support ? (
              <a
                href={support}
                target="_blank"
                rel="noopener noreferrer"
                className="text-primary-on-tint underline print:hidden"
              >
                Escríbenos para pagar
              </a>
            ) : (
              `Escríbenos a ${COMPANY.email} para coordinar el pago.`
            )}
          </p>
        </footer>
      </article>
    </div>
  )
}
