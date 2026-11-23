'use client'

import { LoaderCircleIcon } from 'lucide-react'
import { useRouter } from 'next/navigation'
import { useState, useTransition } from 'react'
import { toast } from 'sonner'
import { recordCourierLedgerEntry } from '@/app/admin/actions'
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
import { formatCOP } from '@/lib/format'

/**
 * Records cash a courier handed over. A deposit pays their debt down at once,
 * so a courier stopped by the cash cap can take cash orders again.
 */
export function CourierLedgerEntryDialog({
  courierId,
  name,
  owed,
}: {
  courierId: string
  name: string
  /** What the courier owes right now, as a positive amount. */
  owed: number
}) {
  const router = useRouter()
  const [open, setOpen] = useState(false)
  const [pending, startTransition] = useTransition()
  const [amount, setAmount] = useState(owed > 0 ? String(owed) : '')
  const [note, setNote] = useState('')

  const submit = () => {
    startTransition(async () => {
      const result = await recordCourierLedgerEntry({
        courierId,
        kind: 'deposit',
        amount,
        note,
      })
      if (!result.ok) {
        toast.error(result.error)
        return
      }
      toast.success(`Consignación de ${name} registrada.`)
      setOpen(false)
      router.refresh()
    })
  }

  return (
    <Dialog open={open} onOpenChange={setOpen}>
      <DialogTrigger asChild>
        <Button size="sm" variant="outline" className="rounded-pill">
          Registrar consignación
        </Button>
      </DialogTrigger>
      <DialogContent>
        <DialogHeader>
          <DialogTitle>Consignación de {name}</DialogTitle>
          <DialogDescription>
            {owed > 0
              ? `Debe ${formatCOP(owed)} en efectivo cobrado. Registra lo que entregó.`
              : 'Registra el efectivo que entregó.'}
          </DialogDescription>
        </DialogHeader>
        <div className="space-y-4">
          <div className="space-y-1.5">
            <Label htmlFor={`deposit-amount-${courierId}`}>Valor (COP)</Label>
            <Input
              id={`deposit-amount-${courierId}`}
              inputMode="numeric"
              value={amount}
              onChange={(event) =>
                setAmount(event.target.value.replace(/[^\d]/g, ''))
              }
              className="rounded-control h-11"
            />
          </div>
          <div className="space-y-1.5">
            <Label htmlFor={`deposit-note-${courierId}`}>
              Referencia{' '}
              <span className="text-muted-foreground font-normal">
                (opcional)
              </span>
            </Label>
            <Input
              id={`deposit-note-${courierId}`}
              value={note}
              maxLength={200}
              placeholder="Ej.: Nequi 12:40, recibo 0045"
              onChange={(event) => setNote(event.target.value)}
              className="rounded-control h-11"
            />
          </div>
        </div>
        <DialogFooter>
          <Button
            variant="ghost"
            onClick={() => setOpen(false)}
            disabled={pending}
          >
            Cancelar
          </Button>
          <Button onClick={submit} disabled={pending || amount === ''}>
            {pending ? (
              <LoaderCircleIcon aria-hidden="true" className="animate-spin" />
            ) : null}
            Registrar
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  )
}
