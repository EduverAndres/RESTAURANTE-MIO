'use client'

import { zodResolver } from '@hookform/resolvers/zod'
import {
  BikeIcon,
  EyeIcon,
  EyeOffIcon,
  LoaderCircleIcon,
  MailCheckIcon,
  ShoppingBagIcon,
  StoreIcon,
  type LucideIcon,
} from 'lucide-react'
import { useRouter } from 'next/navigation'
import { useEffect, useState, useTransition } from 'react'
import { Controller, useForm } from 'react-hook-form'
import { toast } from 'sonner'
import { resendConfirmation, signUp } from '../actions'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { getRoleHome } from '@/lib/auth/roles'
import { cn } from '@/lib/utils'
import {
  registerSchema,
  type RegisterInput,
  type RegisterRole,
  type RegisterValues,
} from '@/lib/validations/auth'

const ROLE_OPTIONS: {
  value: RegisterRole
  title: string
  description: string
  icon: LucideIcon
}[] = [
  {
    value: 'customer',
    title: 'Quiero pedir',
    description: 'Descubre restaurantes y pide en dos toques.',
    icon: ShoppingBagIcon,
  },
  {
    value: 'merchant',
    title: 'Tengo un restaurante',
    description: 'Crea tu tienda con identidad propia.',
    icon: StoreIcon,
  },
  {
    value: 'courier',
    title: 'Soy domiciliario',
    description: 'Acepta entregas cerca de ti.',
    icon: BikeIcon,
  },
]

function FieldError({ id, message }: { id: string; message?: string }) {
  if (!message) return null
  return (
    <p id={id} role="alert" className="text-destructive text-xs">
      {message}
    </p>
  )
}

// Mirrors `[auth.email] max_frequency = "60s"` in supabase/config.toml, the
// minimum interval GoTrue enforces between confirmation emails; a shorter
// cooldown would only produce rate-limit errors.
const RESEND_COOLDOWN_SECONDS = 60

function ResendConfirmation({
  email,
  role,
}: {
  email: string
  role: RegisterRole
}) {
  const [pending, startTransition] = useTransition()
  // The first email was just sent, so the cooldown starts immediately.
  const [cooldown, setCooldown] = useState(RESEND_COOLDOWN_SECONDS)

  useEffect(() => {
    if (cooldown <= 0) return
    const timer = window.setTimeout(
      () => setCooldown((value) => value - 1),
      1000,
    )
    return () => window.clearTimeout(timer)
  }, [cooldown])

  function resend() {
    startTransition(async () => {
      const result = await resendConfirmation(email, getRoleHome(role))
      if (!result.ok) {
        toast.error(result.error)
        return
      }
      toast.success('Te enviamos un nuevo correo de confirmación.')
      setCooldown(RESEND_COOLDOWN_SECONDS)
    })
  }

  const disabled = pending || cooldown > 0

  return (
    <div className="space-y-2">
      <p className="text-muted-foreground text-xs">
        ¿No te llegó? Revisa la carpeta de spam o pide otro enlace.
      </p>
      <Button
        type="button"
        variant="outline"
        disabled={disabled}
        onClick={resend}
        className="rounded-pill h-10 w-full"
      >
        {pending ? (
          <LoaderCircleIcon aria-hidden="true" className="animate-spin" />
        ) : null}
        {cooldown > 0 ? `Reenviar en ${cooldown} s` : 'Reenviar correo'}
      </Button>
    </div>
  )
}

export function RegisterForm({ initialRole }: { initialRole: RegisterRole }) {
  const router = useRouter()
  const [pending, startTransition] = useTransition()
  const [showPassword, setShowPassword] = useState(false)
  const [confirmation, setConfirmation] = useState<{
    email: string
    role: RegisterRole
  } | null>(null)

  const form = useForm<RegisterInput, unknown, RegisterValues>({
    resolver: zodResolver(registerSchema),
    defaultValues: {
      full_name: '',
      email: '',
      password: '',
      phone: '',
      role: initialRole,
    },
  })

  const onSubmit = form.handleSubmit((values) => {
    startTransition(async () => {
      const result = await signUp(values)
      if (!result.ok) {
        toast.error(result.error)
        return
      }
      if (result.redirectTo) {
        toast.success('Cuenta creada. ¡Bienvenido!')
        router.push(result.redirectTo)
        router.refresh()
        return
      }
      setConfirmation({ email: result.email, role: values.role })
    })
  })

  if (confirmation) {
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
          Enviamos un enlace de confirmación a{' '}
          <span className="text-foreground font-medium">
            {confirmation.email}
          </span>
          . Ábrelo para activar tu cuenta.
        </p>
        <ResendConfirmation
          email={confirmation.email}
          role={confirmation.role}
        />
      </div>
    )
  }

  const { errors } = form.formState

  return (
    <form onSubmit={onSubmit} noValidate className="space-y-5">
      <Controller
        control={form.control}
        name="role"
        render={({ field }) => (
          <fieldset className="space-y-2">
            <legend className="text-sm font-medium">
              ¿Cómo quieres usar la plataforma?
            </legend>
            <div
              role="radiogroup"
              aria-label="Tipo de cuenta"
              className="grid gap-2"
            >
              {ROLE_OPTIONS.map(({ value, title, description, icon: Icon }) => {
                const selected = field.value === value
                return (
                  <button
                    key={value}
                    type="button"
                    role="radio"
                    aria-checked={selected}
                    onClick={() => field.onChange(value)}
                    className={cn(
                      'rounded-card flex items-center gap-3 border p-3 text-left transition-all',
                      selected
                        ? 'border-primary bg-primary/6 shadow-soft ring-primary ring-1'
                        : 'border-border bg-card hover:border-foreground/30',
                    )}
                  >
                    <span
                      className={cn(
                        'rounded-control flex size-10 shrink-0 items-center justify-center',
                        selected
                          ? 'bg-primary text-primary-foreground'
                          : 'bg-muted text-muted-foreground',
                      )}
                    >
                      <Icon aria-hidden="true" className="size-5" />
                    </span>
                    <span className="min-w-0">
                      <span className="block text-sm font-medium">{title}</span>
                      <span className="text-muted-foreground block text-xs">
                        {description}
                      </span>
                    </span>
                  </button>
                )
              })}
            </div>
            <FieldError id="role-error" message={errors.role?.message} />
          </fieldset>
        )}
      />

      <div className="space-y-1.5">
        <Label htmlFor="register-name">Nombre completo</Label>
        <Input
          id="register-name"
          autoComplete="name"
          aria-invalid={Boolean(errors.full_name)}
          aria-describedby="register-name-error"
          className="rounded-control h-11"
          {...form.register('full_name')}
        />
        <FieldError
          id="register-name-error"
          message={errors.full_name?.message}
        />
      </div>

      <div className="space-y-1.5">
        <Label htmlFor="register-email">Correo electrónico</Label>
        <Input
          id="register-email"
          type="email"
          inputMode="email"
          autoComplete="email"
          aria-invalid={Boolean(errors.email)}
          aria-describedby="register-email-error"
          className="rounded-control h-11"
          {...form.register('email')}
        />
        <FieldError id="register-email-error" message={errors.email?.message} />
      </div>

      <div className="space-y-1.5">
        <Label htmlFor="register-password">Contraseña</Label>
        <div className="relative">
          <Input
            id="register-password"
            type={showPassword ? 'text' : 'password'}
            autoComplete="new-password"
            aria-invalid={Boolean(errors.password)}
            aria-describedby="register-password-hint register-password-error"
            className="rounded-control h-11 pr-11"
            {...form.register('password')}
          />
          <button
            type="button"
            onClick={() => setShowPassword((value) => !value)}
            aria-label={
              showPassword ? 'Ocultar contraseña' : 'Mostrar contraseña'
            }
            aria-pressed={showPassword}
            className="text-muted-foreground hover:text-foreground absolute inset-y-0 right-0 flex w-11 items-center justify-center"
          >
            {showPassword ? (
              <EyeOffIcon aria-hidden="true" className="size-4" />
            ) : (
              <EyeIcon aria-hidden="true" className="size-4" />
            )}
          </button>
        </div>
        <p
          id="register-password-hint"
          className="text-muted-foreground text-xs"
        >
          Mínimo 8 caracteres.
        </p>
        <FieldError
          id="register-password-error"
          message={errors.password?.message}
        />
      </div>

      <div className="space-y-1.5">
        <Label htmlFor="register-phone">
          Teléfono{' '}
          <span className="text-muted-foreground font-normal">(opcional)</span>
        </Label>
        <Input
          id="register-phone"
          type="tel"
          inputMode="tel"
          autoComplete="tel"
          placeholder="+57 300 123 4567"
          aria-invalid={Boolean(errors.phone)}
          aria-describedby="register-phone-error"
          className="rounded-control h-11"
          {...form.register('phone')}
        />
        <FieldError id="register-phone-error" message={errors.phone?.message} />
      </div>

      <Button
        type="submit"
        disabled={pending}
        className="rounded-pill h-11 w-full text-base"
      >
        {pending ? (
          <LoaderCircleIcon aria-hidden="true" className="animate-spin" />
        ) : null}
        Crear cuenta
      </Button>
    </form>
  )
}
