'use client'

import { zodResolver } from '@hookform/resolvers/zod'
import { LoaderCircleIcon, Undo2Icon } from 'lucide-react'
import { useRouter } from 'next/navigation'
import { useEffect, useState, useTransition } from 'react'
import { useForm, type SubmitHandler } from 'react-hook-form'
import { toast } from 'sonner'
import { z } from 'zod'
import { recordRefundAsAdmin } from '@/app/admin/actions'
import { recordOrderRefund } from '@/app/dashboard/actions'
import { FieldError } from '@/components/dashboard/store/field-error'
import { Button } from '@/components/ui/button'
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog'
import { Label } from '@/components/ui/label'
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select'
import { Textarea } from '@/components/ui/textarea'
import { formatCOP } from '@/lib/format'
import {
  REFUND_METHODS,
  REFUND_METHOD_LABELS,
  REFUND_REASONS,
  REFUND_REASON_LABELS,
} from '@/lib/refunds/vocabulary'
import { REFUND_NOTE_MAX, refundInputSchema } from '@/lib/validations/refunds'

// The order is a prop, not a field, so the form only carries what the person
// actually chooses.
const formSchema = refundInputSchema.omit({ orderId: true })
type RefundFormValues = z.infer<typeof formSchema>

interface RecordRefundDialogProps {
  orderId: string
  shortCode: string
  /** The full order total; partial refunds are out of scope (see plan.ts). */
  total: number
  /**
   * Which server action to call. Both do the same bookkeeping; they differ
   * only in how they prove the caller may touch this order — the merchant
   * through store ownership, the admin through their role.
   */
  variant?: 'merchant' | 'admin'
}

/**
 * Records that the merchant already gave the customer their money back.
 *
 * Nothing here talks to a payment provider — see `lib/refunds/gateway.ts`.
 * The wording says so plainly, because a merchant who reads "reembolsar" and
 * assumes the platform moves the money would never actually return it.
 */
export function RecordRefundDialog({
  orderId,
  shortCode,
  total,
  variant = 'merchant',
}: RecordRefundDialogProps) {
  const router = useRouter()
  const [open, setOpen] = useState(false)
  const [pending, startTransition] = useTransition()
  const form = useForm<RefundFormValues>({
    resolver: zodResolver(formSchema),
    defaultValues: { reason: 'customer_request', method: 'cash', note: '' },
  })

  useEffect(() => {
    if (open) {
      form.reset({ reason: 'customer_request', method: 'cash', note: '' })
    }
  }, [open, form])

  const onSubmit: SubmitHandler<RefundFormValues> = (values) => {
    startTransition(async () => {
      const record =
        variant === 'admin' ? recordRefundAsAdmin : recordOrderRefund
      const result = await record({ ...values, orderId })
      if (!result.ok) {
        toast.error(result.error)
        return
      }
      setOpen(false)
      toast.success(`Reembolso registrado para el pedido #${shortCode}.`)
      router.refresh()
    })
  }

  const noteError = form.formState.errors.note?.message

  return (
    <>
      <Button
        type="button"
        size="sm"
        variant="outline"
        className="rounded-pill"
        onClick={() => setOpen(true)}
      >
        <Undo2Icon aria-hidden="true" className="size-3.5" />
        Registrar reembolso
      </Button>

      <Dialog open={open} onOpenChange={setOpen}>
        <DialogContent className="rounded-card sm:max-w-md">
          <form
            onSubmit={form.handleSubmit(onSubmit)}
            noValidate
            className="space-y-5"
          >
            <DialogHeader>
              <DialogTitle className="font-display text-xl">
                Registrar reembolso del pedido #{shortCode}
              </DialogTitle>
              <DialogDescription>
                {variant === 'admin'
                  ? `Deja constancia de que se devolvieron ${formatCOP(total)} al cliente. Esta pantalla no mueve el dinero: registra la devolución, marca el pedido como reembolsado y la descuenta de la próxima liquidación de la tienda.`
                  : `Deja constancia de que ya devolviste ${formatCOP(total)} al cliente. Esta pantalla no mueve el dinero: registra la devolución que ya hiciste, marca el pedido como reembolsado y la descuenta de tu próxima liquidación.`}
              </DialogDescription>
            </DialogHeader>

            <div className="space-y-1.5">
              <Label htmlFor="refund-reason">Motivo</Label>
              <Select
                value={form.watch('reason')}
                onValueChange={(value) =>
                  form.setValue('reason', value as RefundFormValues['reason'])
                }
              >
                <SelectTrigger id="refund-reason" className="rounded-control h-11 w-full">
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  {REFUND_REASONS.map((reason) => (
                    <SelectItem key={reason} value={reason}>
                      {REFUND_REASON_LABELS[reason]}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>

            <div className="space-y-1.5">
              <Label htmlFor="refund-method">
                {variant === 'admin' ? '¿Cómo se devolvió?' : '¿Cómo lo devolviste?'}
              </Label>
              <Select
                value={form.watch('method')}
                onValueChange={(value) =>
                  form.setValue('method', value as RefundFormValues['method'])
                }
              >
                <SelectTrigger id="refund-method" className="rounded-control h-11 w-full">
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  {REFUND_METHODS.map((method) => (
                    <SelectItem key={method} value={method}>
                      {REFUND_METHOD_LABELS[method]}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>

            <div className="space-y-1.5">
              <Label htmlFor="refund-note">Nota (opcional)</Label>
              <Textarea
                id="refund-note"
                rows={3}
                maxLength={REFUND_NOTE_MAX}
                placeholder="Número de recibo, quién autorizó, etc."
                aria-invalid={Boolean(noteError)}
                aria-describedby="refund-note-error"
                className="rounded-control"
                {...form.register('note')}
              />
              <FieldError id="refund-note-error" message={noteError} />
            </div>

            <DialogFooter>
              <Button
                type="button"
                variant="ghost"
                className="rounded-pill"
                onClick={() => setOpen(false)}
              >
                Cancelar
              </Button>
              <Button type="submit" disabled={pending} className="rounded-pill">
                {pending ? (
                  <LoaderCircleIcon
                    aria-hidden="true"
                    className="animate-spin"
                  />
                ) : null}
                Registrar reembolso
              </Button>
            </DialogFooter>
          </form>
        </DialogContent>
      </Dialog>
    </>
  )
}
