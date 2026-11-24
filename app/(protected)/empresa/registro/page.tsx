import { CheckIcon } from 'lucide-react'
import type { Metadata } from 'next'
import Link from 'next/link'
import { CompanyRegisterForm } from '@/components/companies/company-register-form'
import { Button } from '@/components/ui/button'
import { requireUser } from '@/lib/auth'
import { fetchMyCorporateBudget } from '@/lib/companies/server'
import { createClient } from '@/lib/supabase/server'

export const metadata: Metadata = { title: 'Registrar mi empresa' }
export const dynamic = 'force-dynamic'

const NEXT_STEPS = [
  'El equipo de Cerquita revisa los datos de la empresa.',
  'Aprueba un cupo de crédito y un plazo de pago, y te avisamos.',
  'Invitas a tu equipo con un enlace y le asignas presupuesto.',
] as const

export default async function CompanyRegisterPage() {
  const { user } = await requireUser('/empresa/registro')
  const supabase = await createClient()
  const [budget, { data: profile }] = await Promise.all([
    fetchMyCorporateBudget(supabase),
    supabase
      .from('profiles')
      .select('full_name, phone')
      .eq('id', user.id)
      .maybeSingle(),
  ])

  if (budget) {
    return (
      <div className="rounded-card bg-card shadow-1 p-card max-w-2xl space-y-3">
        <h1 className="text-h2 font-display font-semibold">
          Ya tienes una cuenta de empresa
        </h1>
        <p className="text-muted-foreground text-sm text-pretty">
          Perteneces a {budget.companyName}. Una persona solo puede estar en una
          empresa a la vez.
        </p>
        <Button asChild className="rounded-pill h-11 px-5">
          <Link href="/empresa">Ir a la cuenta de empresa</Link>
        </Button>
      </div>
    )
  }

  return (
    <div className="grid gap-10 lg:grid-cols-[minmax(0,1.4fr)_minmax(0,0.8fr)] lg:items-start">
      <div className="space-y-6">
        <header className="space-y-2">
          <h1 className="text-h1 font-display font-semibold">
            Registrar mi empresa
          </h1>
          <p className="text-muted-foreground text-pretty">
            Con estos datos los restaurantes facturan a tu empresa y Cerquita te
            envía un estado de cuenta al mes. Tú serás el administrador de la
            cuenta.
          </p>
        </header>
        <div className="rounded-card bg-card shadow-1 p-card">
          <CompanyRegisterForm
            defaults={{
              contactName: profile?.full_name ?? '',
              contactPhone: profile?.phone ?? '',
            }}
          />
        </div>
      </div>
      <aside className="rounded-card bg-secondary/50 p-card space-y-4">
        <h2 className="font-display text-xl font-semibold">Qué sigue</h2>
        <ol className="space-y-3 text-sm">
          {NEXT_STEPS.map((step, index) => (
            <li key={step} className="flex gap-3">
              <span
                aria-hidden="true"
                className="bg-primary text-primary-foreground grid size-7 shrink-0 place-items-center rounded-full text-xs font-semibold"
              >
                {index + 1}
              </span>
              <span className="text-pretty">{step}</span>
            </li>
          ))}
        </ol>
        <p className="text-muted-foreground flex items-start gap-2 text-xs text-pretty">
          <CheckIcon
            aria-hidden="true"
            className="text-primary size-4 shrink-0"
          />
          Registrar la empresa no tiene costo: solo pagas los pedidos de tu
          equipo.
        </p>
      </aside>
    </div>
  )
}
