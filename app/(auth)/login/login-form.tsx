'use client'

import { zodResolver } from '@hookform/resolvers/zod'
import { EyeIcon, EyeOffIcon, LoaderCircleIcon } from 'lucide-react'
import Link from 'next/link'
import { useRouter } from 'next/navigation'
import { useEffect, useState, useTransition } from 'react'
import { useForm } from 'react-hook-form'
import { toast } from 'sonner'
import { acceptLegalTerms, signInWithPassword } from '../actions'
import { OAuthButtons } from '@/components/auth/oauth-buttons'
import { ConsentCheckbox } from '@/components/legal/consent-checkbox'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs'
import { callbackErrorFromParams } from '@/lib/auth/callback'
import {
  AUTH_ERROR_MESSAGES,
  callbackErrorMessage,
  mapAuthError,
} from '@/lib/auth/errors'
import { getRoleHome } from '@/lib/auth/roles'
import { createClient } from '@/lib/supabase/client'
import {
  loginSchema,
  phoneOtpSchema,
  verifyOtpSchema,
  type LoginInput,
} from '@/lib/validations/auth'

interface LoginFormProps {
  next: string | null
  /** Error key from `/login?error=<key>`, set by the auth callback. */
  callbackError: string | null
  /** Sign-in methods switched on in Supabase; the rest are not rendered. */
  providers: { google: boolean; microsoft: boolean; phone: boolean }
  /** Development: render Google/Microsoft even when off (see OAuthButtons). */
  showUnavailableProviders: boolean
}

// GoTrue reports implicit-flow failures in the URL hash (never sent to the
// server), so a stale link may arrive here as `#error_code=otp_expired`.
function callbackErrorFromHash(): string | null {
  if (typeof window === 'undefined') return null
  const hash = window.location.hash.replace(/^#/, '')
  if (!hash) return null
  const key = callbackErrorFromParams(new URLSearchParams(hash))
  if (key) window.history.replaceState(null, '', window.location.pathname)
  return key
}

const CONSENT_REQUIRED =
  'Debes aceptar los Términos y la Política de Tratamiento de Datos para continuar.'

function FieldError({ id, message }: { id: string; message?: string }) {
  if (!message) return null
  return (
    <p id={id} role="alert" className="text-destructive text-xs">
      {message}
    </p>
  )
}

export function LoginForm({
  next,
  callbackError,
  providers,
  showUnavailableProviders,
}: LoginFormProps) {
  const router = useRouter()
  const [pending, startTransition] = useTransition()
  const [showPassword, setShowPassword] = useState(false)

  useEffect(() => {
    const message = callbackErrorMessage(
      callbackError ?? callbackErrorFromHash(),
    )
    if (message) toast.error(message)
  }, [callbackError])

  const form = useForm<LoginInput>({
    resolver: zodResolver(loginSchema),
    defaultValues: { email: '', password: '', accept_terms: false },
  })

  // One box covers every way in. Google and SMS do not go through the
  // resolver, so they ask through here and get the same error.
  function ensureAccepted(): boolean {
    if (form.getValues('accept_terms')) return true
    form.setError('accept_terms', { message: CONSENT_REQUIRED })
    document.getElementById('login-accept')?.focus()
    return false
  }

  const onSubmit = form.handleSubmit((values) => {
    startTransition(async () => {
      const result = await signInWithPassword(values, next)
      if (!result.ok) {
        toast.error(result.error)
        return
      }
      toast.success('Bienvenido de nuevo.')
      router.push(result.redirectTo)
      router.refresh()
    })
  })

  return (
    <Tabs defaultValue="email" className="w-full">
      {/* A single way in needs no tabs to choose between. */}
      {providers.phone ? (
        <TabsList className="rounded-pill grid w-full grid-cols-2">
          <TabsTrigger value="email" className="rounded-pill">
            Correo
          </TabsTrigger>
          <TabsTrigger value="phone" className="rounded-pill">
            Teléfono
          </TabsTrigger>
        </TabsList>
      ) : null}

      {/*
        Above both tabs and every button: whichever way the person signs in,
        they say yes first. Unticked by default — a pre-ticked box is not
        consent.
      */}
      <ConsentCheckbox
        id="login-accept"
        className={providers.phone ? 'pt-4' : undefined}
        error={form.formState.errors.accept_terms?.message}
        {...form.register('accept_terms', {
          onChange: () => form.clearErrors('accept_terms'),
        })}
      />

      <TabsContent value="email" className="space-y-5 pt-4">
        {/*
          Google first, and big. For most people it is one tap against two
          fields and a password they half remember; burying it under the form
          it replaces is the wrong way round.
        */}
        <OAuthButtons
          enabled={providers}
          showUnavailable={showUnavailableProviders}
          next={next}
          ensureAccepted={ensureAccepted}
          separatorLabel="o con tu correo"
        />

        <form onSubmit={onSubmit} noValidate className="space-y-4">
          <div className="space-y-1.5">
            <Label htmlFor="login-email">Correo electrónico</Label>
            <Input
              id="login-email"
              type="email"
              autoComplete="email"
              inputMode="email"
              placeholder="tu@correo.com"
              aria-invalid={Boolean(form.formState.errors.email)}
              aria-describedby="login-email-error"
              className="rounded-control h-11"
              {...form.register('email')}
            />
            <FieldError
              id="login-email-error"
              message={form.formState.errors.email?.message}
            />
          </div>

          <div className="space-y-1.5">
            <div className="flex items-center justify-between">
              <Label htmlFor="login-password">Contraseña</Label>
              <Link
                href="/forgot-password"
                className="text-primary text-xs font-medium underline-offset-4 hover:underline"
              >
                ¿Olvidaste tu contraseña?
              </Link>
            </div>
            <div className="relative">
              <Input
                id="login-password"
                type={showPassword ? 'text' : 'password'}
                autoComplete="current-password"
                aria-invalid={Boolean(form.formState.errors.password)}
                aria-describedby="login-password-error"
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
            <FieldError
              id="login-password-error"
              message={form.formState.errors.password?.message}
            />
          </div>

          <Button
            type="submit"
            disabled={pending}
            className="rounded-pill h-12 w-full text-base"
          >
            {pending ? (
              <LoaderCircleIcon aria-hidden="true" className="animate-spin" />
            ) : null}
            Entrar
          </Button>
        </form>
      </TabsContent>

      {providers.phone ? (
        <TabsContent value="phone" className="pt-4">
          <PhoneOtpForm next={next} ensureAccepted={ensureAccepted} />
        </TabsContent>
      ) : null}
    </Tabs>
  )
}

function PhoneOtpForm({
  next,
  ensureAccepted,
}: {
  next: string | null
  ensureAccepted: () => boolean
}) {
  const router = useRouter()
  const [phone, setPhone] = useState('')
  const [token, setToken] = useState('')
  const [step, setStep] = useState<'phone' | 'code'>('phone')
  const [error, setError] = useState<string | null>(null)
  const [pending, startTransition] = useTransition()

  function mapOtpError(cause: {
    code?: string | null
    message?: string | null
  }) {
    const message = mapAuthError(cause)
    return message === AUTH_ERROR_MESSAGES.providerDisabled
      ? 'El ingreso por SMS no está habilitado todavía.'
      : message
  }

  function sendCode(event: React.FormEvent) {
    event.preventDefault()
    if (!ensureAccepted()) return
    const parsed = phoneOtpSchema.safeParse({ phone })
    if (!parsed.success) {
      setError(parsed.error.issues[0]?.message ?? 'Teléfono inválido.')
      return
    }
    setError(null)
    startTransition(async () => {
      const supabase = createClient()
      const { error: otpError } = await supabase.auth.signInWithOtp({
        phone: parsed.data.phone,
      })
      if (otpError) {
        setError(mapOtpError(otpError))
        return
      }
      setPhone(parsed.data.phone)
      setStep('code')
      toast.success('Te enviamos un código por SMS.')
    })
  }

  function verifyCode(event: React.FormEvent) {
    event.preventDefault()
    const parsed = verifyOtpSchema.safeParse({ phone, token })
    if (!parsed.success) {
      setError(parsed.error.issues[0]?.message ?? 'Código inválido.')
      return
    }
    setError(null)
    startTransition(async () => {
      const supabase = createClient()
      const { data, error: verifyError } = await supabase.auth.verifyOtp({
        phone: parsed.data.phone,
        token: parsed.data.token,
        type: 'sms',
      })
      if (verifyError || !data.session) {
        setError(mapOtpError(verifyError ?? {}))
        return
      }
      // The session was created in the browser; record the box ticked on
      // this form before the first navigation meets the legal gate.
      const accepted = await acceptLegalTerms('login-sms', next)
      toast.success('Bienvenido.')
      if (accepted.ok) {
        router.push(accepted.redirectTo)
        router.refresh()
        return
      }
      router.push(next ?? getRoleHome(data.session.user.app_metadata?.role))
      router.refresh()
    })
  }

  if (step === 'code') {
    return (
      <form onSubmit={verifyCode} noValidate className="space-y-4">
        <div className="space-y-1.5">
          <Label htmlFor="otp-code">Código de 6 dígitos</Label>
          <Input
            id="otp-code"
            inputMode="numeric"
            autoComplete="one-time-code"
            maxLength={6}
            value={token}
            onChange={(event) =>
              setToken(event.target.value.replace(/\D/g, ''))
            }
            aria-invalid={Boolean(error)}
            aria-describedby="otp-error"
            className="rounded-control h-11 text-center text-lg tracking-[0.4em]"
          />
          <p className="text-muted-foreground text-xs">Enviado a {phone}.</p>
          <FieldError id="otp-error" message={error ?? undefined} />
        </div>
        <Button
          type="submit"
          disabled={pending}
          className="rounded-pill h-11 w-full text-base"
        >
          {pending ? (
            <LoaderCircleIcon aria-hidden="true" className="animate-spin" />
          ) : null}
          Verificar y entrar
        </Button>
        <Button
          type="button"
          variant="ghost"
          className="rounded-pill w-full"
          onClick={() => {
            setStep('phone')
            setToken('')
            setError(null)
          }}
        >
          Usar otro número
        </Button>
      </form>
    )
  }

  return (
    <form onSubmit={sendCode} noValidate className="space-y-4">
      <div className="space-y-1.5">
        <Label htmlFor="otp-phone">Número de teléfono</Label>
        <Input
          id="otp-phone"
          type="tel"
          inputMode="tel"
          autoComplete="tel"
          placeholder="+57 300 123 4567"
          value={phone}
          onChange={(event) => setPhone(event.target.value)}
          aria-invalid={Boolean(error)}
          aria-describedby="otp-phone-error"
          className="rounded-control h-11"
        />
        <p className="text-muted-foreground text-xs">
          Incluye el indicativo del país, por ejemplo +57 para Colombia.
        </p>
        <FieldError id="otp-phone-error" message={error ?? undefined} />
      </div>
      <Button
        type="submit"
        disabled={pending}
        className="rounded-pill h-11 w-full text-base"
      >
        {pending ? (
          <LoaderCircleIcon aria-hidden="true" className="animate-spin" />
        ) : null}
        Enviar código
      </Button>
    </form>
  )
}
