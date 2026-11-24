'use client'

import { zodResolver } from '@hookform/resolvers/zod'
import { LoaderCircleIcon, PencilIcon } from 'lucide-react'
import { useRouter } from 'next/navigation'
import { useState, useTransition } from 'react'
import { useForm } from 'react-hook-form'
import { toast } from 'sonner'
import { updateBilling } from '@/app/(protected)/empresa/actions'
import { FieldError } from '@/components/forms/field-error'
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
import {
  companyBillingSchema,
  type CompanyBillingInput,
} from '@/lib/validations/companies'

const FIELDS = [
  {
    name: 'billingEmail',
    label: 'Correo para facturas',
    type: 'email',
    autoComplete: 'email',
  },
  {
    name: 'billingAddress',
    label: 'Dirección de facturación',
    type: 'text',
    autoComplete: 'street-address',
  },
  {
    name: 'city',
    label: 'Ciudad',
    type: 'text',
    autoComplete: 'address-level2',
  },
  {
    name: 'contactName',
    label: 'Persona de contacto',
    type: 'text',
    autoComplete: 'name',
  },
  {
    name: 'contactPhone',
    label: 'Celular de contacto',
    type: 'tel',
    autoComplete: 'tel',
  },
] as const

/**
 * Edits where invoices go and who answers for the account. The legal name
 * and the NIT are what the credit line was approved for, so they are not
 * here: changing them goes through the Cerquita team.
 */
export function BillingDialog({ defaults }: { defaults: CompanyBillingInput }) {
  const router = useRouter()
  const [open, setOpen] = useState(false)
  const [pending, startTransition] = useTransition()
  const form = useForm<CompanyBillingInput>({
    resolver: zodResolver(companyBillingSchema),
    defaultValues: defaults,
  })
  const { errors } = form.formState

  const onSubmit = form.handleSubmit(() => {
    const input = form.getValues()
    startTransition(async () => {
      const result = await updateBilling(input)
      if (!result.ok) {
        if (result.field)
          form.setError(result.field as keyof CompanyBillingInput, {
            message: result.error,
          })
        toast.error(result.error)
        return
      }
      toast.success('Datos de facturación actualizados.')
      setOpen(false)
      router.refresh()
    })
  })

  return (
    <Dialog open={open} onOpenChange={setOpen}>
      <DialogTrigger asChild>
        <Button variant="outline" size="sm" className="rounded-pill">
          <PencilIcon aria-hidden="true" />
          Editar
        </Button>
      </DialogTrigger>
      <DialogContent className="rounded-card">
        <DialogHeader>
          <DialogTitle className="font-display text-xl">
            Datos de facturación
          </DialogTitle>
          <DialogDescription>
            Los comercios facturan a la razón social y al NIT de tu empresa.
            Para cambiarlos, escríbenos.
          </DialogDescription>
        </DialogHeader>
        <form onSubmit={onSubmit} noValidate className="space-y-4">
          {FIELDS.map((field) => (
            <div key={field.name} className="space-y-1.5">
              <Label htmlFor={`billing-${field.name}`}>{field.label}</Label>
              <Input
                id={`billing-${field.name}`}
                type={field.type}
                autoComplete={field.autoComplete}
                aria-invalid={Boolean(errors[field.name])}
                aria-describedby={`billing-${field.name}-error`}
                className="rounded-control h-11"
                {...form.register(field.name)}
              />
              <FieldError
                id={`billing-${field.name}-error`}
                message={errors[field.name]?.message}
              />
            </div>
          ))}
          <DialogFooter>
            <Button
              type="submit"
              disabled={pending}
              className="rounded-pill h-11 px-6"
            >
              {pending ? (
                <LoaderCircleIcon aria-hidden="true" className="animate-spin" />
              ) : null}
              Guardar
            </Button>
          </DialogFooter>
        </form>
      </DialogContent>
    </Dialog>
  )
}
