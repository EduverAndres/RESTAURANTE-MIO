import { ExternalLinkIcon } from 'lucide-react'
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
import { RecordRefundDialog } from '@/components/refunds/record-refund-dialog'
import { requireRole } from '@/lib/auth'
import { formatCOP } from '@/lib/format'
import { formatDateCO } from '@/lib/format-date'
import { paymentStatusLabel } from '@/lib/orders/status'
import {
  countActionable,
  fetchStuckPaymentEvents,
} from '@/lib/payments/stuck-events'
import {
  UNAPPLIED_EVENT_REASON_HINTS,
  UNAPPLIED_EVENT_REASON_LABELS,
  UNAPPLIED_EVENT_REASON_TONES,
} from '@/lib/payments/unapplied-events'

export const metadata: Metadata = { title: 'Pagos sin aplicar' }
export const dynamic = 'force-dynamic'

export default async function AdminPaymentsPage() {
  await requireRole(['admin'], '/admin/payments')
  const { rows, total, truncated } = await fetchStuckPaymentEvents()
  const actionable = countActionable(rows)

  return (
    <div className="mx-auto max-w-6xl space-y-6">
      <header className="space-y-1">
        <h1 className="font-display text-3xl font-semibold tracking-tight sm:text-4xl">
          Pagos sin aplicar
        </h1>
        <p className="text-muted-foreground text-sm">
          {total === 0
            ? 'Eventos que la pasarela entregó y que nunca se reflejaron en su pedido.'
            : `${total} evento${total === 1 ? '' : 's'} que la pasarela entregó y que nunca se reflejaron en su pedido.`}{' '}
          {actionable === 0
            ? 'Ninguno de los mostrados requiere intervención en este momento.'
            : `${actionable} de los mostrados requiere${actionable === 1 ? '' : 'n'} revisión manual.`}
        </p>
        {/*
          The list is capped, and what falls off is the newest. Saying so is
          the whole point: an operator who reads a truncated list as the
          complete one concludes the backlog is 200 when it is thousands.
        */}
        {truncated ? (
          <p className="text-destructive text-sm font-medium">
            Se muestran los {rows.length} más antiguos de {total}. Faltan{' '}
            {total - rows.length} por revisar; resuelve estos y vuelve a cargar
            la página para ver los siguientes.
          </p>
        ) : null}
      </header>

      {rows.length > 0 ? (
        <div className="rounded-card border-border bg-card shadow-soft overflow-x-auto border">
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead>Motivo</TableHead>
                <TableHead>Pedido</TableHead>
                <TableHead>Referencia</TableHead>
                <TableHead className="text-right">Monto cobrado</TableHead>
                <TableHead>Pasarela</TableHead>
                <TableHead className="text-right">Recibido</TableHead>
                <TableHead className="text-right">Acción</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {rows.map((row) => (
                <TableRow key={row.id}>
                  <TableCell>
                    <StatusBadge
                      label={UNAPPLIED_EVENT_REASON_LABELS[row.reason]}
                      tone={UNAPPLIED_EVENT_REASON_TONES[row.reason]}
                    />
                    <span className="text-muted-foreground mt-1 block max-w-xs text-xs">
                      {UNAPPLIED_EVENT_REASON_HINTS[row.reason]}
                    </span>
                  </TableCell>
                  <TableCell>
                    {row.orderId && row.shortCode ? (
                      <>
                        <Link
                          href={`/orders/${row.orderId}`}
                          className="inline-flex items-center gap-1 font-mono font-medium underline-offset-4 hover:underline"
                        >
                          #{row.shortCode}
                          <ExternalLinkIcon
                            aria-hidden="true"
                            className="size-3"
                          />
                        </Link>
                        <span className="text-muted-foreground block text-xs">
                          {paymentStatusLabel(row.paymentStatus ?? '')}
                          {row.total === null
                            ? ''
                            : ` · ${formatCOP(row.total)}`}
                        </span>
                      </>
                    ) : (
                      <span className="text-muted-foreground text-sm">
                        Sin pedido
                      </span>
                    )}
                  </TableCell>
                  <TableCell className="font-mono text-xs break-all">
                    {row.reference}
                  </TableCell>
                  <TableCell className="text-right tabular-nums">
                    {row.amount === null ? '—' : formatCOP(row.amount)}
                  </TableCell>
                  <TableCell>
                    <span className="font-medium">{row.gatewayStatus}</span>
                    <span className="text-muted-foreground block text-xs">
                      {row.provider}
                    </span>
                  </TableCell>
                  <TableCell className="text-muted-foreground text-right">
                    {formatDateCO(row.received_at)}
                  </TableCell>
                  <TableCell className="text-right">
                    {/*
                      The only action the platform can take here without a
                      confirmed gateway refund API: record that the money went
                      back. See `lib/refunds/gateway.ts`.
                    */}
                    {row.refundable ? (
                      <RecordRefundDialog
                        variant="admin"
                        orderId={row.refundable.orderId}
                        shortCode={row.refundable.shortCode}
                        total={row.refundable.total}
                      />
                    ) : (
                      <span className="text-muted-foreground text-xs">—</span>
                    )}
                  </TableCell>
                </TableRow>
              ))}
            </TableBody>
          </Table>
        </div>
      ) : (
        <EmptyState
          title="No hay pagos sin aplicar"
          description="Todos los eventos recibidos se reflejaron en su pedido."
        />
      )}
    </div>
  )
}
