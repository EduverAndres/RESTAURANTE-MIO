'use client'

import { LoaderCircleIcon, RefreshCwIcon } from 'lucide-react'
import { useRouter } from 'next/navigation'
import { useId, useState, useTransition } from 'react'
import { toast } from 'sonner'
import {
  generateCompanyStatements,
  markStatementPaid,
  refreshOverdueStatements,
  voidStatement,
} from '@/app/admin/companies/actions'
import { Button } from '@/components/ui/button'
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from '@/components/ui/dialog'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { periodTitle } from '@/lib/companies/period'

/** Bills a closed month for every company, then stamps the overdue ones. */
export function GenerateStatementsForm({ periods }: { periods: string[] }) {
  const id = useId()
  const router = useRouter()
  const [period, setPeriod] = useState(periods[0] ?? '')
  const [pending, startTransition] = useTransition()
  const [refreshing, startRefresh] = useTransition()

  return (
    <div className="flex flex-wrap items-end gap-3">
      <form
        className="flex flex-wrap items-end gap-3"
        onSubmit={(event) => {
          event.preventDefault()
          startTransition(async () => {
            const result = await generateCompanyStatements(period)
            if (!result.ok) {
              toast.error(result.error)
              return
            }
            toast.success(
              result.created === 0
                ? result.skipped > 0
                  ? 'Ese mes ya estaba facturado.'
                  : 'No hay pedidos por facturar en ese mes.'
                : `${result.created} estado${result.created === 1 ? '' : 's'} de cuenta generado${result.created === 1 ? '' : 's'}.`,
            )
            router.refresh()
          })
        }}
      >
        <div className="space-y-1.5">
          <Label htmlFor={`${id}-period`}>Mes cerrado</Label>
          <select
            id={`${id}-period`}
            value={period}
            onChange={(event) => setPeriod(event.target.value)}
            className="border-input bg-background rounded-control h-11 border px-3 text-sm"
          >
            {periods.map((value) => (
              <option key={value} value={value}>
                {periodTitle(value)}
              </option>
            ))}
          </select>
        </div>
        <Button
          type="submit"
          disabled={pending || !period}
          className="rounded-pill h-11 px-5"
        >
          {pending ? (
            <LoaderCircleIcon aria-hidden="true" className="animate-spin" />
          ) : null}
          Generar estados de cuenta
        </Button>
      </form>
      <Button
        type="button"
        variant="outline"
        disabled={refreshing}
        className="rounded-pill h-11"
        onClick={() =>
          startRefresh(async () => {
            const result = await refreshOverdueStatements()
            if (!result.ok) {
              toast.error(result.error)
              return
            }
            toast.success(
              result.updated === 0
                ? 'No hay estados de cuenta nuevos vencidos.'
                : `${result.updated} marcado${result.updated === 1 ? '' : 's'} como vencido${result.updated === 1 ? '' : 's'}.`,
            )
            router.refresh()
          })
        }
      >
        <RefreshCwIcon aria-hidden="true" />
        Revisar vencidos
      </Button>
    </div>
  )
}

/** Records the company's payment, with its bank reference. */
export function MarkStatementPaidDialog({
  statementId,
  label,
}: {
  statementId: string
  label: string
}) {
  const id = useId()
  const router = useRouter()
  const [open, setOpen] = useState(false)
  const [reference, setReference] = useState('')
  const [pending, startTransition] = useTransition()

  return (
    <Dialog open={open} onOpenChange={setOpen}>
      <DialogTrigger asChild>
        <Button size="sm" className="rounded-pill">
          Marcar pagado<span className="sr-only"> {label}</span>
        </Button>
      </DialogTrigger>
      <DialogContent className="rounded-card">
        <DialogHeader>
          <DialogTitle className="font-display text-xl">
            Pago de {label}
          </DialogTitle>
          <DialogDescription>
            Al marcarlo pagado se libera el cupo de la empresa y deja de contar
            para la mora.
          </DialogDescription>
        </DialogHeader>
        <form
          className="space-y-4"
          onSubmit={(event) => {
            event.preventDefault()
            startTransition(async () => {
              const result = await markStatementPaid({
                statementId,
                paymentRef: reference,
              })
              if (!result.ok) {
                toast.error(result.error)
                return
              }
              toast.success('Estado de cuenta pagado.')
              setOpen(false)
              router.refresh()
            })
          }}
        >
          <div className="space-y-1.5">
            <Label htmlFor={`${id}-ref`}>
              Referencia del pago{' '}
              <span className="text-muted-foreground font-normal">
                (opcional)
              </span>
            </Label>
            <Input
              id={`${id}-ref`}
              value={reference}
              maxLength={80}
              onChange={(event) => setReference(event.target.value)}
              className="rounded-control h-11"
            />
          </div>
          <DialogFooter>
            <Button
              type="submit"
              disabled={pending}
              className="rounded-pill h-11 px-6"
            >
              {pending ? (
                <LoaderCircleIcon aria-hidden="true" className="animate-spin" />
              ) : null}
              Marcar pagado
            </Button>
          </DialogFooter>
        </form>
      </DialogContent>
    </Dialog>
  )
}

/** Annuls an unpaid statement; its orders go back to "not billed yet". */
export function VoidStatementDialog({
  statementId,
  label,
}: {
  statementId: string
  label: string
}) {
  const id = useId()
  const router = useRouter()
  const [open, setOpen] = useState(false)
  const [reason, setReason] = useState('')
  const [pending, startTransition] = useTransition()

  return (
    <Dialog open={open} onOpenChange={setOpen}>
      <DialogTrigger asChild>
        <Button
          size="sm"
          variant="ghost"
          className="rounded-pill text-destructive-on-tint"
        >
          Anular<span className="sr-only"> {label}</span>
        </Button>
      </DialogTrigger>
      <DialogContent className="rounded-card">
        <DialogHeader>
          <DialogTitle className="font-display text-xl">
            Anular {label}
          </DialogTitle>
          <DialogDescription>
            Sus pedidos vuelven a quedar sin facturar y entran en el próximo
            estado de cuenta que generes para ese mes.
          </DialogDescription>
        </DialogHeader>
        <form
          className="space-y-4"
          onSubmit={(event) => {
            event.preventDefault()
            startTransition(async () => {
              const result = await voidStatement({ statementId, reason })
              if (!result.ok) {
                toast.error(result.error)
                return
              }
              toast.success('Estado de cuenta anulado.')
              setOpen(false)
              router.refresh()
            })
          }}
        >
          <div className="space-y-1.5">
            <Label htmlFor={`${id}-reason`}>Motivo</Label>
            <Input
              id={`${id}-reason`}
              value={reason}
              maxLength={200}
              onChange={(event) => setReason(event.target.value)}
              className="rounded-control h-11"
            />
          </div>
          <DialogFooter>
            <Button
              type="submit"
              disabled={pending}
              className="rounded-pill bg-destructive hover:bg-destructive/90 h-11 px-6 text-white"
            >
              {pending ? (
                <LoaderCircleIcon aria-hidden="true" className="animate-spin" />
              ) : null}
              Anular
            </Button>
          </DialogFooter>
        </form>
      </DialogContent>
    </Dialog>
  )
}
