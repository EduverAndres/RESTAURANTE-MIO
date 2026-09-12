import type { Metadata } from 'next'
import { ResetPasswordForm } from './reset-password-form'
import { requireUser } from '@/lib/auth'

export const metadata: Metadata = { title: 'Nueva contraseña' }
export const dynamic = 'force-dynamic'

export default async function ResetPasswordPage() {
  await requireUser('/account/reset-password')

  return (
    <div className="container-page py-12">
      <div className="mx-auto max-w-md space-y-6">
        <div className="space-y-2">
          <h1 className="font-display text-3xl font-semibold tracking-tight">
            Crea una contraseña nueva
          </h1>
          <p className="text-muted-foreground text-sm">
            Elige una contraseña de al menos 8 caracteres que no uses en otros
            sitios.
          </p>
        </div>
        <div className="rounded-card border-border bg-card shadow-soft border p-5">
          <ResetPasswordForm />
        </div>
      </div>
    </div>
  )
}
