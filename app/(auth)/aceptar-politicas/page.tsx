import type { Metadata } from 'next'
import { redirect } from 'next/navigation'
import { AcceptTermsForm } from './accept-terms-form'
import { resolveUserRole } from '@/lib/auth/resolve-role'
import { getRoleHome } from '@/lib/auth/roles'
import { safeNextPath } from '@/lib/auth/safe-next'
import { hasAcceptedCurrent, LEGAL_UPDATED_AT } from '@/lib/legal/consent'
import { createClient } from '@/lib/supabase/server'

export const metadata: Metadata = {
  title: 'Acepta nuestras políticas',
  robots: { index: false },
}

interface PageProps {
  searchParams: Promise<{ next?: string }>
}

/**
 * Where the middleware sends a signed-in session that has not accepted the
 * legal documents in force: accounts created before they existed, a sign-in
 * that skipped the login form (an email link, Google from elsewhere), and
 * everyone after `LEGAL_VERSION` changes.
 */
export default async function AcceptPoliciesPage({ searchParams }: PageProps) {
  const { next } = await searchParams
  const supabase = await createClient()
  const {
    data: { user },
  } = await supabase.auth.getUser()

  if (!user) redirect('/login')

  const role = await resolveUserRole(supabase, user)
  if (hasAcceptedCurrent(user.user_metadata)) {
    redirect(safeNextPath(next) ?? getRoleHome(role))
  }

  return (
    <div className="space-y-6">
      <div className="space-y-2">
        <h1 className="text-h2 font-display font-semibold">
          Antes de continuar
        </h1>
        <p className="text-muted-foreground text-sm text-pretty">
          Actualizamos nuestras políticas el {LEGAL_UPDATED_AT}. Para seguir
          usando la plataforma necesitamos que las leas y las aceptes. Puedes
          abrir cada documento sin perder esta página.
        </p>
      </div>
      <AcceptTermsForm
        next={next ?? null}
        partner={role === 'merchant' || role === 'courier'}
      />
    </div>
  )
}
