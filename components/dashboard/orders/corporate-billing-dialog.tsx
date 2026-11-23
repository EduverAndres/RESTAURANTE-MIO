'use client'

import { Building2Icon, LoaderCircleIcon } from 'lucide-react'
import { useId, useState, useTransition } from 'react'
import { toast } from 'sonner'
import {
  getCorporateBilling,
  saveMerchantInvoiceRef,
  type CorporateBillingView,
} from '@/app/dashboard/billing-actions'
import { Badge } from '@/components/ui/badge'
import { Button } from '@/components/ui/button'
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from '@/components/ui/dialog'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { CORPORATE_BADGE_LABEL } from '@/lib/orders/kanban'
import { formatCOP } from '@/lib/format'
import { cn } from '@/lib/utils'

/**
 * "Empresa · no cobrar": the order is paid with a company account, so nobody
 * collects anything at the door, and the merchant invoices the company.
 */
export function CorporateBadge({ className }: { className?: string }) {
  return (
    <Badge
      variant="outline"
      className={cn(
        'rounded-pill bg-primary/10 text-primary-on-tint border-transparent text-xs font-semibold',
        className,
      )}
    >
      <Building2Icon aria-hidden="true" className="size-3" />
      {CORPORATE_BADGE_LABEL}
    </Badge>
  )
}

/**
 * Who to invoice a corporate order to: the company's legal name, NIT and
 * billing contact as they were when the charge was authorised. The merchant
 * can note the number of the invoice once issued.
 */
export function CorporateBillingDialog({
  orderId,
  shortCode,
  size = 'sm',
}: {
  orderId: string
  shortCode: string
  size?: 'sm' | 'xs'
}) {
  const id = useId()
  const [open, setOpen] = useState(false)
  const [billing, setBilling] = useState<CorporateBillingView | null>(null)
  const [error, setError] = useState<string | null>(null)
  const [invoice, setInvoice] = useState('')
  const [loading, startLoading] = useTransition()
  const [saving, startSaving] = useTransition()

  function load(next: boolean) {
    setOpen(next)
    if (!next) return
    setError(null)
    startLoading(async () => {
      const result = await getCorporateBilling(orderId)
      if (!result.ok) {
        setBilling(null)
        setError(result.error)
        return
      }
      setBilling(result.billing)
      setInvoice(result.billing.invoiceRef ?? '')
    })
  }

  function save(event: React.FormEvent) {
    event.preventDefault()
    startSaving(async () => {
      const result = await saveMerchantInvoiceRef({
        orderId,
        invoiceRef: invoice,
      })
      if (!result.ok) {
        toast.error(result.error)
        return
      }
      toast.success('Número de factura guardado.')
      setBilling((current) =>
        current ? { ...current, invoiceRef: invoice.trim() } : current,
      )
    })
  }

  return (
    <Dialog open={open} onOpenChange={load}>
      <DialogTrigger asChild>
        <Button
          type="button"
          variant="outline"
          size="sm"
          className={cn('rounded-pill', size === 'xs' && 'h-8 px-3 text-xs')}
        >
          Datos para facturar
          <span className="sr-only"> del pedido #{shortCode}</span>
        </Button>
      </DialogTrigger>
      <DialogContent className="rounded-card">
        <DialogHeader>
          <DialogTitle className="font-display text-xl">
            Datos para facturar · #{shortCode}
          </DialogTitle>
          <DialogDescription>
            Lo paga una empresa con su cuenta: no cobres nada al entregar.
            Factura a nombre de la empresa; Cerquita te paga el pedido en tu
            liquidación.
          </DialogDescription>
        </DialogHeader>
        {loading ? (
          <p className="text-muted-foreground flex items-center gap-2 text-sm">
            <LoaderCircleIcon
              aria-hidden="true"
              className="size-4 animate-spin"
            />
            Cargando…
          </p>
        ) : error ? (
          <p role="alert" className="text-destructive text-sm">
            {error}
          </p>
        ) : billing ? (
          <div className="space-y-5">
            <dl className="rounded-card bg-muted/60 grid gap-3 p-4 text-sm sm:grid-cols-2">
              <div>
                <dt className="text-muted-foreground">Razón social</dt>
                <dd className="font-semibold">{billing.legalName}</dd>
              </div>
              <div>
                <dt className="text-muted-foreground">NIT</dt>
                <dd className="font-semibold tabular-nums">{billing.nit}</dd>
              </div>
              <div>
                <dt className="text-muted-foreground">
                  Correo para la factura
                </dt>
                <dd className="font-medium break-all">
                  {billing.billingEmail}
                </dd>
              </div>
              <div>
                <dt className="text-muted-foreground">Dirección</dt>
                <dd className="font-medium">{billing.billingAddress}</dd>
              </div>
              <div>
                <dt className="text-muted-foreground">Valor del pedido</dt>
                <dd className="font-medium tabular-nums">
                  {formatCOP(billing.total)}
                </dd>
              </div>
              {billing.reference ? (
                <div>
                  <dt className="text-muted-foreground">Motivo</dt>
                  <dd className="font-medium">{billing.reference}</dd>
                </div>
              ) : null}
            </dl>
            <form onSubmit={save} className="space-y-1.5">
              <Label htmlFor={`${id}-invoice`}>Número de tu factura</Label>
              <div className="flex gap-2">
                <Input
                  id={`${id}-invoice`}
                  value={invoice}
                  maxLength={60}
                  placeholder="FE-1234"
                  onChange={(event) => setInvoice(event.target.value)}
                  className="rounded-control h-11"
                />
                <Button
                  type="submit"
                  variant="outline"
                  disabled={saving || invoice.trim() === ''}
                  className="rounded-pill h-11"
                >
                  {saving ? (
                    <LoaderCircleIcon
                      aria-hidden="true"
                      className="animate-spin"
                    />
                  ) : null}
                  Guardar
                </Button>
              </div>
              <p className="text-muted-foreground text-xs">
                Opcional: te sirve para cuadrar tus facturas con la liquidación.
              </p>
            </form>
          </div>
        ) : null}
      </DialogContent>
    </Dialog>
  )
}
