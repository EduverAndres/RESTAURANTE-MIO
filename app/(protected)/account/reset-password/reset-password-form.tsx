'use client'

import { zodResolver } from '@hookform/resolvers/zod'
import { LoaderCircleIcon } from 'lucide-react'
import { useRouter } from 'next/navigation'
import { useTransition } from 'react'
import { useForm } from 'react-hook-form'
import { toast } from 'sonner'
import { updatePassword } from '@/app/(auth)/actions'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import {
  resetPasswordSchema,
  type ResetPasswordInput,
} from '@/lib/validations/auth'

export function ResetPasswordForm() {
  const router = useRouter()
  const [pending, startTransition] = useTransition()

  const form = useForm<ResetPasswordInput>({
    resolver: zodResolver(resetPasswordSchema),
    defaultValues: { password: '', confirm: '' },
  })

  const onSubmit = form.handleSubmit((values) => {
    startTransition(async () => {
      const result = await updatePassword(values)
      if (!result.ok) {
        toast.error(result.error)
        return
      }
      toast.success('Contraseña actualizada.')
      router.push('/account')
      router.refresh()
    })
  })

  const { errors } = form.formState

  return (
    <form onSubmit={onSubmit} noValidate className="space-y-4">
      <div className="space-y-1.5">
        <Label htmlFor="reset-password">Nueva contraseña</Label>
        <Input
          id="reset-password"
          type="password"
          autoComplete="new-password"
          aria-invalid={Boolean(errors.password)}
          aria-describedby="reset-password-error"
          className="rounded-control h-11"
          {...form.register('password')}
        />
        {errors.password?.message ? (
          <p
            id="reset-password-error"
            role="alert"
            className="text-destructive text-xs"
          >
            {errors.password.message}
          </p>
        ) : null}
      </div>
      <div className="space-y-1.5">
        <Label htmlFor="reset-confirm">Confirmar contraseña</Label>
        <Input
          id="reset-confirm"
          type="password"
          autoComplete="new-password"
          aria-invalid={Boolean(errors.confirm)}
          aria-describedby="reset-confirm-error"
          className="rounded-control h-11"
          {...form.register('confirm')}
        />
        {errors.confirm?.message ? (
          <p
            id="reset-confirm-error"
            role="alert"
            className="text-destructive text-xs"
          >
            {errors.confirm.message}
          </p>
        ) : null}
      </div>
      <Button
        type="submit"
        disabled={pending}
        className="rounded-pill h-11 w-full"
      >
        {pending ? (
          <LoaderCircleIcon aria-hidden="true" className="animate-spin" />
        ) : null}
        Guardar contraseña
      </Button>
    </form>
  )
}
