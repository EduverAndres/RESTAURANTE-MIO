'use client'

import { zodResolver } from '@hookform/resolvers/zod'
import { LoaderCircleIcon, MailCheckIcon } from 'lucide-react'
import { useState, useTransition } from 'react'
import { useForm } from 'react-hook-form'
import { toast } from 'sonner'
import { requestPasswordReset } from '../actions'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import {
  forgotPasswordSchema,
  type ForgotPasswordInput,
} from '@/lib/validations/auth'

export function ForgotPasswordForm() {
  const [pending, startTransition] = useTransition()
  const [sentTo, setSentTo] = useState<string | null>(null)

  const form = useForm<ForgotPasswordInput>({
    resolver: zodResolver(forgotPasswordSchema),
    defaultValues: { email: '' },
  })

  const onSubmit = form.handleSubmit((values) => {
    startTransition(async () => {
      const result = await requestPasswordReset(values)
      if (!result.ok) {
        toast.error(result.error)
        return
      }
      setSentTo(values.email)
    })
  })

  if (sentTo) {
    return (
      <div
        role="status"
        className="rounded-card border-border bg-card shadow-soft space-y-4 border p-6 text-center"
      >
        <span className="rounded-pill bg-primary/10 text-primary mx-auto flex size-14 items-center justify-center">
          <MailCheckIcon aria-hidden="true" className="size-7" />
        </span>
        <h2 className="font-display text-2xl font-semibold">
          Revisa tu correo
        </h2>
        <p className="text-muted-foreground text-sm">
          Si existe una cuenta para{' '}
          <span className="text-foreground font-medium">{sentTo}</span>,
          recibirás un enlace para cambiar la contraseña en unos minutos.
        </p>
      </div>
    )
  }

  const error = form.formState.errors.email?.message

  return (
    <form onSubmit={onSubmit} noValidate className="space-y-4">
      <div className="space-y-1.5">
        <Label htmlFor="forgot-email">Correo electrónico</Label>
        <Input
          id="forgot-email"
          type="email"
          inputMode="email"
          autoComplete="email"
          aria-invalid={Boolean(error)}
          aria-describedby="forgot-email-error"
          className="rounded-control h-11"
          {...form.register('email')}
        />
        {error ? (
          <p
            id="forgot-email-error"
            role="alert"
            className="text-destructive text-xs"
          >
            {error}
          </p>
        ) : null}
      </div>
      <Button
        type="submit"
        disabled={pending}
        className="rounded-pill h-11 w-full text-base"
      >
        {pending ? (
          <LoaderCircleIcon aria-hidden="true" className="animate-spin" />
        ) : null}
        Enviar enlace
      </Button>
    </form>
  )
}
