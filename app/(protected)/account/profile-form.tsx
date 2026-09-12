'use client'

import { zodResolver } from '@hookform/resolvers/zod'
import { LoaderCircleIcon } from 'lucide-react'
import { useRouter } from 'next/navigation'
import { useTransition } from 'react'
import { useForm } from 'react-hook-form'
import { toast } from 'sonner'
import { updateProfile } from './actions'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import {
  profileSchema,
  type ProfileInput,
  type ProfileValues,
} from '@/lib/validations/auth'

interface ProfileFormProps {
  fullName: string
  phone: string
}

export function ProfileForm({ fullName, phone }: ProfileFormProps) {
  const router = useRouter()
  const [pending, startTransition] = useTransition()

  const form = useForm<ProfileInput, unknown, ProfileValues>({
    resolver: zodResolver(profileSchema),
    defaultValues: { full_name: fullName, phone },
  })

  const onSubmit = form.handleSubmit((values) => {
    // Zod normalises an empty phone to null; the action re-validates the
    // raw input shape, so map it back before sending.
    const input: ProfileInput = {
      full_name: values.full_name,
      phone: values.phone ?? '',
    }
    startTransition(async () => {
      const result = await updateProfile(input)
      if (!result.ok) {
        toast.error(result.error)
        return
      }
      toast.success('Perfil actualizado.')
      form.reset(input)
      router.refresh()
    })
  })

  const { errors, isDirty } = form.formState

  return (
    <form onSubmit={onSubmit} noValidate className="space-y-4">
      <div className="space-y-1.5">
        <Label htmlFor="profile-name">Nombre completo</Label>
        <Input
          id="profile-name"
          autoComplete="name"
          aria-invalid={Boolean(errors.full_name)}
          aria-describedby="profile-name-error"
          className="rounded-control h-11"
          {...form.register('full_name')}
        />
        {errors.full_name?.message ? (
          <p
            id="profile-name-error"
            role="alert"
            className="text-destructive text-xs"
          >
            {errors.full_name.message}
          </p>
        ) : null}
      </div>
      <div className="space-y-1.5">
        <Label htmlFor="profile-phone">Teléfono</Label>
        <Input
          id="profile-phone"
          type="tel"
          inputMode="tel"
          autoComplete="tel"
          placeholder="+57 300 123 4567"
          aria-invalid={Boolean(errors.phone)}
          aria-describedby="profile-phone-error"
          className="rounded-control h-11"
          {...form.register('phone')}
        />
        {errors.phone?.message ? (
          <p
            id="profile-phone-error"
            role="alert"
            className="text-destructive text-xs"
          >
            {errors.phone.message}
          </p>
        ) : null}
      </div>
      <Button
        type="submit"
        disabled={pending || !isDirty}
        className="rounded-pill"
      >
        {pending ? (
          <LoaderCircleIcon aria-hidden="true" className="animate-spin" />
        ) : null}
        Guardar cambios
      </Button>
    </form>
  )
}
