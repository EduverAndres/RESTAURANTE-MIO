import type { Metadata } from 'next'
import Link from 'next/link'
import { redirect } from 'next/navigation'
import { LoginForm } from './login-form'
import { getCurrentUser, getRoleHome } from '@/lib/auth'
import { safeNextPath } from '@/lib/auth/safe-next'

export const metadata: Metadata = { title: 'Iniciar sesión' }

interface LoginPageProps {
  searchParams: Promise<{ next?: string; error?: string }>
}

export default async function LoginPage({ searchParams }: LoginPageProps) {
  const { next, error } = await searchParams
  const safeNext = safeNextPath(next)

  const current = await getCurrentUser()
  if (current) redirect(safeNext ?? getRoleHome(current.role))

  return (
    <div className="space-y-8">
      <div className="space-y-2">
        <h1 className="text-h1 font-display font-semibold">Hola de nuevo</h1>
        <p className="text-muted-foreground">
          Entra para pedir, seguir tus pedidos o gestionar tu restaurante.
        </p>
      </div>

      <LoginForm next={safeNext} callbackError={error ?? null} />

      <p className="text-muted-foreground text-center text-sm">
        ¿No tienes cuenta?{' '}
        <Link
          href={
            safeNext
              ? `/register?next=${encodeURIComponent(safeNext)}`
              : '/register'
          }
          className="text-primary font-medium underline-offset-4 hover:underline"
        >
          Regístrate
        </Link>
      </p>
    </div>
  )
}
