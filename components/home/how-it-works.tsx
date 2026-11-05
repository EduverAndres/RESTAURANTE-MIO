import { ArrowRightIcon } from 'lucide-react'
import Link from 'next/link'
import { Button } from '@/components/ui/button'
import { listPaymentOptions } from '@/lib/payments'
import { describeHowToPay } from '@/lib/payments/summary'

/**
 * Three steps, because ordering is a sequence: the numbers are information.
 *
 * The payment step is built from the gateways that are switched on, so the
 * home never names a method the checkout does not offer. The subtitle is
 * where the table QR gets explained to someone who has never used one.
 *
 * Server-rendered and painted at rest, like the rest of the home.
 */
export function HowItWorks() {
  const steps = [
    {
      title: 'Elige un negocio',
      text: 'Restaurantes y negocios de tu zona, con el tiempo estimado de entrega antes de pedir.',
    },
    {
      title: 'Pide y paga como prefieras',
      text: `${describeHowToPay(listPaymentOptions().map((option) => option.method))} El precio es el de la carta.`,
    },
    {
      title: 'Síguelo en vivo',
      text: 'Ves cada paso, del fogón a tu puerta, y lo recibes con un código que solo tú tienes.',
    },
  ]

  return (
    <section
      aria-labelledby="como-funciona-title"
      className="border-border/60 border-t"
    >
      <div className="container-page py-section space-y-8">
        <div className="max-w-2xl space-y-2">
          <h2
            id="como-funciona-title"
            className="text-h2 font-display font-semibold"
          >
            Cómo funciona
          </h2>
          <p className="text-muted-foreground text-pretty">
            Sin descargar nada. Y si estás en el negocio, escanea el QR de tu
            mesa y pide sin crear cuenta.
          </p>
        </div>

        <ol className="gap-card grid sm:grid-cols-3">
          {steps.map((step, index) => (
            <li
              key={step.title}
              className="rounded-card bg-card shadow-1 p-card space-y-2"
            >
              <span
                aria-hidden="true"
                className="rounded-control bg-primary/10 font-display text-primary-on-tint flex size-10 items-center justify-center text-lg font-semibold tabular-nums"
              >
                {index + 1}
              </span>
              <h3 className="font-display text-xl font-semibold">
                {step.title}
              </h3>
              <p className="text-muted-foreground text-sm text-pretty">
                {step.text}
              </p>
            </li>
          ))}
        </ol>

        <Button asChild size="lg" variant="outline" className="rounded-pill">
          <Link href="/para-restaurantes">
            Tengo un negocio
            <ArrowRightIcon aria-hidden="true" data-icon="inline-end" />
          </Link>
        </Button>
      </div>
    </section>
  )
}
