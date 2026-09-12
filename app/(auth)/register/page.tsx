import type { Metadata } from 'next'
import Link from 'next/link'
import { redirect } from 'next/navigation'
import { RegisterForm } from './register-form'
import { getCurrentUser, getRoleHome } from '@/lib/auth'
import { safeNextPath } from '@/lib/auth/safe-next'
import { REGISTER_ROLES, type RegisterRole } from '@/lib/validations/auth'

export const metadata: Metadata = { title: 'Crear cuenta' }

interface RegisterPageProps {
  searchParams: Promise<{ role?: string; next?: string }>
}

function initialRole(value: string | undefined): RegisterRole {
  return (REGISTER_ROLES as readonly string[]).includes(value ?? '')
    ? (value as RegisterRole)
    : 'customer'
}

export default async function RegisterPage({
  searchParams,
}: RegisterPageProps) {
  const { role, next } = await searchParams
  const safeNext = safeNextPath(next)

  const current = await getCurrentUser()
  if (current) redirect(safeNext ?? getRoleHome(current.role))

  return (
    <div className="space-y-8">
      <div className="space-y-2">
        <h1 className="text-h1 font-display font-semibold">Crea tu cuenta</h1>
        <p className="text-muted-foreground">
          Cuéntanos cómo quieres usar la plataforma y listo.
        </p>
      </div>

      <RegisterForm initialRole={initialRole(role)} />

      <p className="text-muted-foreground text-center text-sm">
        ¿Ya tienes cuenta?{' '}
        <Link
          href={
            safeNext ? `/login?next=${encodeURIComponent(safeNext)}` : '/login'
          }
          className="text-primary font-medium underline-offset-4 hover:underline"
        >
          Inicia sesión
        </Link>
      </p>
    </div>
  )
}
