'use client'

import { zodResolver } from '@hookform/resolvers/zod'
import { LoaderCircleIcon } from 'lucide-react'
import { useRouter } from 'next/navigation'
import { useTransition } from 'react'
import { Controller, useForm } from 'react-hook-form'
import { toast } from 'sonner'
import { registerCompany } from '@/app/(protected)/empresa/actions'
import { FieldError } from '@/components/forms/field-error'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import {
  companyRegisterSchema,
  type CompanyRegisterInput,
  type CompanyRegisterValues,
} from '@/lib/validations/companies'

type FieldName = Exclude<keyof CompanyRegisterInput, 'acceptTerms'>

interface FieldSpec {
  name: FieldName
  label: string
  hint?: string
  optional?: boolean
  type?: string
  autoComplete?: string
  inputMode?: 'numeric' | 'tel' | 'email'
  wide?: boolean
}

const COMPANY_FIELDS: FieldSpec[] = [
  {
    name: 'legalName',
    label: 'Razón social',
    hint: 'Como aparece en el RUT.',
    autoComplete: 'organization',
    wide: true,
  },
  { name: 'tradeName', label: 'Nombre comercial', optional: true },
  {
    name: 'nit',
    label: 'NIT con dígito de verificación',
    hint: 'Por ejemplo 900.123.456-8.',
    inputMode: 'numeric',
    autoComplete: 'off',
  },
]

const BILLING_FIELDS: FieldSpec[] = [
  {
    name: 'billingEmail',
    label: 'Correo para facturas',
    type: 'email',
    autoComplete: 'email',
    inputMode: 'email',
  },
  { name: 'city', label: 'Ciudad', autoComplete: 'address-level2' },
  {
    name: 'billingAddress',
    label: 'Dirección de facturación',
    autoComplete: 'street-address',
    wide: true,
  },
  { name: 'contactName', label: 'Persona de contacto', autoComplete: 'name' },
  {
    name: 'contactPhone',
    label: 'Celular de contacto',
    type: 'tel',
    autoComplete: 'tel',
    inputMode: 'tel',
  },
]

/**
 * Signs a company up. The person filling it in becomes the account's first
 * admin; the Cerquita team reviews the company and approves a credit line
 * before anyone can charge it.
 */
export function CompanyRegisterForm({
  defaults,
}: {
  defaults: Pick<CompanyRegisterInput, 'contactName' | 'contactPhone'>
}) {
  const router = useRouter()
  const [pending, startTransition] = useTransition()
  const form = useForm<CompanyRegisterInput, unknown, CompanyRegisterValues>({
    resolver: zodResolver(companyRegisterSchema),
    defaultValues: {
      legalName: '',
      tradeName: '',
      nit: '',
      billingEmail: '',
      billingAddress: '',
      city: 'Barranquilla',
      contactName: defaults.contactName,
      contactPhone: defaults.contactPhone,
      acceptTerms: false as unknown as true,
    },
  })
  const { errors } = form.formState

  const onSubmit = form.handleSubmit(() => {
    const input = form.getValues()
    startTransition(async () => {
      const result = await registerCompany(input)
      if (!result.ok) {
        if (result.field)
          form.setError(result.field as keyof CompanyRegisterInput, {
            message: result.error,
          })
        toast.error(result.error)
        return
      }
      toast.success('¡Listo! Recibimos la solicitud de tu empresa.')
      router.push('/empresa')
      router.refresh()
    })
  })

  const field = (spec: FieldSpec) => {
    const id = `company-${spec.name}`
    const describedBy = [spec.hint ? `${id}-hint` : null, `${id}-error`]
      .filter(Boolean)
      .join(' ')
    return (
      <div
        key={spec.name}
        className={spec.wide ? 'space-y-1.5 sm:col-span-2' : 'space-y-1.5'}
      >
        <Label htmlFor={id}>
          {spec.label}
          {spec.optional ? (
            <span className="text-muted-foreground font-normal">
              {' '}
              (opcional)
            </span>
          ) : null}
        </Label>
        <Input
          id={id}
          type={spec.type ?? 'text'}
          inputMode={spec.inputMode}
          autoComplete={spec.autoComplete}
          aria-invalid={Boolean(errors[spec.name])}
          aria-describedby={describedBy}
          className="rounded-control h-11"
          {...form.register(spec.name)}
        />
        {spec.hint ? (
          <p id={`${id}-hint`} className="text-muted-foreground text-xs">
            {spec.hint}
          </p>
        ) : null}
        <FieldError id={`${id}-error`} message={errors[spec.name]?.message} />
      </div>
    )
  }

  return (
    <form onSubmit={onSubmit} noValidate className="space-y-8">
      <fieldset className="space-y-4">
        <legend className="font-display mb-2 text-xl font-semibold">
          La empresa
        </legend>
        <div className="grid gap-4 sm:grid-cols-2">
          {COMPANY_FIELDS.map(field)}
        </div>
      </fieldset>

      <fieldset className="space-y-4">
        <legend className="font-display mb-2 text-xl font-semibold">
          Facturación y contacto
        </legend>
        <div className="grid gap-4 sm:grid-cols-2">
          {BILLING_FIELDS.map(field)}
        </div>
      </fieldset>

      <div className="space-y-2">
        <Controller
          control={form.control}
          name="acceptTerms"
          render={({ field: checkbox }) => (
            <label className="flex items-start gap-3 text-sm">
              <input
                type="checkbox"
                id="company-terms"
                checked={checkbox.value === true}
                onChange={(event) => checkbox.onChange(event.target.checked)}
                aria-invalid={Boolean(errors.acceptTerms)}
                aria-describedby="company-terms-error"
                className="accent-primary mt-0.5 size-5 shrink-0"
              />
              <span className="text-pretty">
                Acepto los{' '}
                <a
                  href="/terminos-empresas"
                  target="_blank"
                  rel="noopener noreferrer"
                  className="text-primary-on-tint font-medium underline underline-offset-2"
                >
                  Términos para Empresas
                </a>{' '}
                en nombre de la empresa y declaro que puedo representarla.
              </span>
            </label>
          )}
        />
        <FieldError
          id="company-terms-error"
          message={errors.acceptTerms?.message}
        />
      </div>

      <Button
        type="submit"
        disabled={pending}
        className="rounded-pill h-12 w-full px-6 text-base sm:w-auto"
      >
        {pending ? (
          <LoaderCircleIcon aria-hidden="true" className="animate-spin" />
        ) : null}
        Enviar solicitud
      </Button>
    </form>
  )
}
