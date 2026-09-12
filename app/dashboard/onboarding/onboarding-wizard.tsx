'use client'

import { zodResolver } from '@hookform/resolvers/zod'
import { ArrowLeftIcon, ArrowRightIcon, LoaderCircleIcon } from 'lucide-react'
import Link from 'next/link'
import { useRouter } from 'next/navigation'
import { useState, useTransition } from 'react'
import { useForm } from 'react-hook-form'
import { toast } from 'sonner'
import { createStore } from '@/app/dashboard/store/actions'
import { StoreAssetUploader } from '@/components/dashboard/store/store-asset-uploader'
import { StoreBasicsFields } from '@/components/dashboard/store/store-basics-fields'
import { StoreLogisticsFields } from '@/components/dashboard/store/store-logistics-fields'
import { Button } from '@/components/ui/button'
import { cn } from '@/lib/utils'
import {
  createStoreSchema,
  type CreateStoreInput,
  type CreateStoreValues,
} from '@/lib/validations/store'

const STEPS = [
  { title: 'Datos básicos', description: 'Nombre, categoría y contacto.' },
  {
    title: 'Ubicación y entregas',
    description: 'Dónde estás y cómo entregas.',
  },
  { title: 'Imágenes', description: 'Logo y portada (opcional).' },
] as const

const BASICS_FIELDS = [
  'name',
  'slug',
  'category',
  'description',
  'whatsapp_phone',
] as const

/** Where the merchant lands after the wizard: straight into the menu. */
const ONBOARDING_DONE_PATH = '/dashboard/menu'

interface OnboardingWizardProps {
  hasStores: boolean
}

function StepIndicator({ current }: { current: number }) {
  return (
    <ol className="grid grid-cols-3 gap-2" aria-label="Progreso">
      {STEPS.map((step, index) => {
        const done = index < current
        const active = index === current
        return (
          <li
            key={step.title}
            aria-current={active ? 'step' : undefined}
            className="space-y-2"
          >
            <span
              aria-hidden="true"
              className={cn(
                'block h-1.5 rounded-full',
                done || active ? 'bg-primary' : 'bg-muted',
              )}
            />
            <p
              className={cn(
                'text-xs font-medium',
                active ? 'text-foreground' : 'text-muted-foreground',
              )}
            >
              {index + 1}. {step.title}
            </p>
          </li>
        )
      })}
    </ol>
  )
}

export function OnboardingWizard({ hasStores }: OnboardingWizardProps) {
  const router = useRouter()
  const [step, setStep] = useState(0)
  const [created, setCreated] = useState<{
    storeId: string
    slug: string
  } | null>(null)
  const [pending, startTransition] = useTransition()

  const form = useForm<CreateStoreInput, unknown, CreateStoreValues>({
    resolver: zodResolver(createStoreSchema),
    mode: 'onBlur',
    defaultValues: {
      name: '',
      slug: '',
      category: '',
      description: '',
      whatsapp_phone: '',
      address: '',
      lat: Number.NaN,
      lng: Number.NaN,
      delivery_radius_km: 5,
      delivery_fee: 0,
      min_order: 0,
      prep_time_min: 25,
    },
  })

  async function nextFromBasics() {
    const valid = await form.trigger([...BASICS_FIELDS])
    if (!valid || form.formState.errors.slug) return
    setStep(1)
  }

  const submitLogistics = form.handleSubmit((values) => {
    startTransition(async () => {
      // Zod normalises empty optionals to null; the action re-validates the
      // raw input shape, so map them back before sending.
      const result = await createStore({
        ...values,
        description: values.description ?? '',
        whatsapp_phone: values.whatsapp_phone ?? '',
      })
      if (!result.ok) {
        toast.error(result.error)
        return
      }
      setCreated({ storeId: result.storeId, slug: result.slug })
      setStep(2)
      router.refresh()
    })
  })

  function finish() {
    toast.success('Tu tienda quedó creada.', {
      description:
        'Permanecerá en revisión hasta que un administrador la active; mientras tanto puedes armar tu carta.',
      duration: 8000,
    })
    router.push(ONBOARDING_DONE_PATH)
  }

  const current = STEPS[step]

  return (
    <div className="space-y-6">
      <StepIndicator current={step} />

      <section
        aria-labelledby="onboarding-step-title"
        className="rounded-card border-border bg-card shadow-soft space-y-6 border p-5 sm:p-6"
      >
        <header className="space-y-1">
          <h2
            id="onboarding-step-title"
            className="font-display text-2xl font-semibold"
          >
            {current.title}
          </h2>
          <p className="text-muted-foreground text-sm">{current.description}</p>
        </header>

        {step === 0 ? (
          <form
            noValidate
            onSubmit={(event) => {
              event.preventDefault()
              void nextFromBasics()
            }}
            className="space-y-6"
          >
            <StoreBasicsFields form={form} autoSlug idPrefix="onboarding" />
            <div className="flex items-center justify-between gap-3">
              {hasStores ? (
                <Button asChild variant="ghost" className="rounded-pill">
                  <Link href="/dashboard">Volver al panel</Link>
                </Button>
              ) : (
                <span />
              )}
              <Button type="submit" className="rounded-pill">
                Continuar
                <ArrowRightIcon aria-hidden="true" />
              </Button>
            </div>
          </form>
        ) : null}

        {step === 1 ? (
          <form noValidate onSubmit={submitLogistics} className="space-y-6">
            <StoreLogisticsFields form={form} idPrefix="onboarding" />
            <div className="flex items-center justify-between gap-3">
              <Button
                type="button"
                variant="ghost"
                className="rounded-pill"
                disabled={pending}
                onClick={() => setStep(0)}
              >
                <ArrowLeftIcon aria-hidden="true" />
                Atrás
              </Button>
              <Button type="submit" disabled={pending} className="rounded-pill">
                {pending ? (
                  <LoaderCircleIcon
                    aria-hidden="true"
                    className="animate-spin"
                  />
                ) : null}
                Crear tienda
              </Button>
            </div>
          </form>
        ) : null}

        {step === 2 && created ? (
          <div className="space-y-6">
            <StoreAssetUploader
              storeId={created.storeId}
              kind="logo"
              currentUrl={null}
            />
            <StoreAssetUploader
              storeId={created.storeId}
              kind="cover"
              currentUrl={null}
            />
            <p className="text-muted-foreground text-xs">
              Tu tienda pública estará en{' '}
              <span className="font-mono">/t/{created.slug}</span> cuando sea
              activada.
            </p>
            <div className="flex items-center justify-end gap-3">
              <Button type="button" className="rounded-pill" onClick={finish}>
                Terminar
                <ArrowRightIcon aria-hidden="true" />
              </Button>
            </div>
          </div>
        ) : null}
      </section>
    </div>
  )
}
