'use client'

import { LoaderCircleIcon } from 'lucide-react'
import { useRouter } from 'next/navigation'
import { useId, useState, useTransition } from 'react'
import { toast } from 'sonner'
import {
  approveCompany,
  suspendCompany,
  updateCompanyTerms,
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
import { Textarea } from '@/components/ui/textarea'
import {
  PAYMENT_TERMS_OPTIONS,
  type CompanyStatus,
} from '@/lib/companies/vocabulary'
import { parsePesosInput } from '@/lib/validations/companies'

interface CompanyTerms {
  creditLimit: number
  paymentTermsDays: number
  maxTipPct: number
}

/**
 * Approve (a pending company) or reactivate (a suspended one) with a credit
 * line, payment terms and a tip cap; suspend an active one with a reason.
 */
export function CompanyReviewActions({
  companyId,
  name,
  status,
  terms,
}: {
  companyId: string
  name: string
  status: CompanyStatus
  terms: CompanyTerms
}) {
  return status === 'active' ? (
    <div className="flex flex-wrap justify-end gap-1">
      <ApproveDialog
        companyId={companyId}
        name={name}
        terms={terms}
        label="Ajustar cupo"
      />
      <SuspendDialog companyId={companyId} name={name} />
    </div>
  ) : (
    <ApproveDialog
      companyId={companyId}
      name={name}
      terms={terms}
      label={status === 'pending' ? 'Aprobar' : 'Reactivar'}
    />
  )
}

function ApproveDialog({
  companyId,
  name,
  terms,
  label,
}: {
  companyId: string
  name: string
  terms: CompanyTerms
  label: string
}) {
  const id = useId()
  const router = useRouter()
  const [open, setOpen] = useState(false)
  const [pending, startTransition] = useTransition()
  const [credit, setCredit] = useState(
    terms.creditLimit > 0 ? terms.creditLimit.toLocaleString('es-CO') : '',
  )
  const [days, setDays] = useState(terms.paymentTermsDays)
  const [tip, setTip] = useState(String(terms.maxTipPct))
  const adjusting = label === 'Ajustar cupo'

  function submit(event: React.FormEvent) {
    event.preventDefault()
    const input = {
      companyId,
      creditLimit: parsePesosInput(credit) ?? Number.NaN,
      paymentTermsDays: days,
      maxTipPct: Number(tip),
    }
    startTransition(async () => {
      const result = adjusting
        ? await updateCompanyTerms(input)
        : await approveCompany(input)
      if (!result.ok) {
        toast.error(result.error)
        return
      }
      toast.success(
        adjusting ? 'Condiciones actualizadas.' : 'Empresa aprobada.',
      )
      setOpen(false)
      router.refresh()
    })
  }

  return (
    <Dialog open={open} onOpenChange={setOpen}>
      <DialogTrigger asChild>
        <Button
          size="sm"
          variant={adjusting ? 'ghost' : 'default'}
          className="rounded-pill"
        >
          {label}
          <span className="sr-only"> {name}</span>
        </Button>
      </DialogTrigger>
      <DialogContent className="rounded-card">
        <DialogHeader>
          <DialogTitle className="font-display text-xl">
            {label} {name}
          </DialogTitle>
          <DialogDescription>
            El cupo es lo máximo que la empresa puede deber a la vez: pedidos
            sin facturar más estados de cuenta sin pagar.
          </DialogDescription>
        </DialogHeader>
        <form onSubmit={submit} className="space-y-4">
          <div className="space-y-1.5">
            <Label htmlFor={`${id}-credit`}>Cupo de crédito</Label>
            <Input
              id={`${id}-credit`}
              inputMode="numeric"
              placeholder="2.000.000"
              value={credit}
              onChange={(event) => setCredit(event.target.value)}
              className="rounded-control h-11"
            />
          </div>
          <div className="grid grid-cols-2 gap-4">
            <div className="space-y-1.5">
              <Label htmlFor={`${id}-days`}>Plazo de pago</Label>
              <select
                id={`${id}-days`}
                value={days}
                onChange={(event) => setDays(Number(event.target.value))}
                className="border-input bg-background rounded-control h-11 w-full border px-3 text-sm"
              >
                {PAYMENT_TERMS_OPTIONS.map((option) => (
                  <option key={option} value={option}>
                    {option} días
                  </option>
                ))}
              </select>
            </div>
            <div className="space-y-1.5">
              <Label htmlFor={`${id}-tip`}>Tope de propina (%)</Label>
              <Input
                id={`${id}-tip`}
                type="number"
                min={0}
                max={30}
                value={tip}
                onChange={(event) => setTip(event.target.value)}
                className="rounded-control h-11"
              />
            </div>
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
              {adjusting ? 'Guardar' : label}
            </Button>
          </DialogFooter>
        </form>
      </DialogContent>
    </Dialog>
  )
}

function SuspendDialog({
  companyId,
  name,
}: {
  companyId: string
  name: string
}) {
  const id = useId()
  const router = useRouter()
  const [open, setOpen] = useState(false)
  const [pending, startTransition] = useTransition()
  const [note, setNote] = useState('')

  function submit(event: React.FormEvent) {
    event.preventDefault()
    startTransition(async () => {
      const result = await suspendCompany({ companyId, note })
      if (!result.ok) {
        toast.error(result.error)
        return
      }
      toast.success('Empresa suspendida.')
      setOpen(false)
      router.refresh()
    })
  }

  return (
    <Dialog open={open} onOpenChange={setOpen}>
      <DialogTrigger asChild>
        <Button
          size="sm"
          variant="ghost"
          className="rounded-pill text-destructive-on-tint"
        >
          Suspender<span className="sr-only"> {name}</span>
        </Button>
      </DialogTrigger>
      <DialogContent className="rounded-card">
        <DialogHeader>
          <DialogTitle className="font-display text-xl">
            Suspender {name}
          </DialogTitle>
          <DialogDescription>
            Nadie podrá pagar con la cuenta hasta que la reactives. Los pedidos
            en curso siguen.
          </DialogDescription>
        </DialogHeader>
        <form onSubmit={submit} className="space-y-4">
          <div className="space-y-1.5">
            <Label htmlFor={`${id}-note`}>Motivo</Label>
            <Textarea
              id={`${id}-note`}
              value={note}
              maxLength={300}
              onChange={(event) => setNote(event.target.value)}
              className="rounded-control min-h-20"
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
              Suspender
            </Button>
          </DialogFooter>
        </form>
      </DialogContent>
    </Dialog>
  )
}
