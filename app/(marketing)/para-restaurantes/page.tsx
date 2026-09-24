import { ArrowRightIcon } from 'lucide-react'
import type { Metadata } from 'next'
import Link from 'next/link'
import { SiteFooter } from '@/components/layout/site-footer'
import { ForRestaurants } from '@/components/marketing/for-restaurants'
import { FadeIn } from '@/components/motion/fade-in'
import { Button } from '@/components/ui/button'
import { APP_NAME } from '@/lib/env'

export const metadata: Metadata = {
  title: `${APP_NAME} · El canal propio de tu restaurante`,
  description:
    'Recibí pedidos a domicilio, para recoger y desde la mesa con tu propia marca, sin pagar comisión por cada venta.',
}

/**
 * The page addressed to the person who pays: the restaurant owner.
 *
 * It lives on its own route rather than at the bottom of the diner home.
 * A diner has no business reading a commission calculator, and an owner
 * reading it does not want a bottom tab bar inviting them to order sushi.
 * The two audiences still meet: "Ver una tienda de verdad" sends the owner
 * to a real storefront, which is the strongest argument the product has.
 */

const STEPS = [
  {
    title: 'Armá tu carta',
    body: 'Categorías, productos, fotos y opciones. Los cambios se publican al instante.',
  },
  {
    title: 'Elegí tu estilo',
    body: 'Colores, tipografías y portada. Tu tienda se ve como tu local, no como un catálogo ajeno.',
  },
  {
    title: 'Imprimí los QR',
    body: 'Uno por mesa. El comensal escanea, pide desde su celular y la cocina se entera al toque.',
  },
] as const

export default function OwnerLandingPage() {
  return (
    <>
      <ForRestaurants standalone />

      <section className="border-border/60 border-t">
        <div className="container-page py-section">
          <FadeIn inView className="space-y-8">
            <h2 className="text-h1 font-display font-semibold">
              Empezar toma una tarde
            </h2>
            <ol className="gap-card grid md:grid-cols-3">
              {STEPS.map((step, index) => (
                <li
                  key={step.title}
                  className="rounded-card bg-card shadow-1 p-card space-y-2"
                >
                  <span className="rounded-control bg-primary/10 font-display text-primary-on-tint flex size-10 items-center justify-center text-lg font-semibold tabular-nums">
                    {index + 1}
                  </span>
                  <h3 className="font-display text-xl font-semibold">
                    {step.title}
                  </h3>
                  <p className="text-muted-foreground text-sm text-pretty">
                    {step.body}
                  </p>
                </li>
              ))}
            </ol>
          </FadeIn>
        </div>
      </section>

      <section className="border-border/60 bg-secondary/40 border-t">
        <div className="container-page py-section">
          <FadeIn inView className="mx-auto max-w-2xl space-y-4 text-center">
            <h2 className="text-h1 font-display font-semibold text-balance">
              ¿Lo probamos con tu carta?
            </h2>
            <p className="text-muted-foreground text-pretty">
              Armá tu tienda y mirala funcionando. Si no te convence, no
              perdiste nada más que una tarde.
            </p>
            <div className="flex flex-wrap justify-center gap-3 pt-2">
              <Button asChild size="lg">
                <Link href="/register">
                  Crear mi tienda
                  <ArrowRightIcon aria-hidden="true" data-icon="inline-end" />
                </Link>
              </Button>
              <Button asChild size="lg" variant="outline">
                <Link href="/t/sushi-nocturno">Ver una tienda de verdad</Link>
              </Button>
            </div>
          </FadeIn>
        </div>
      </section>

      <SiteFooter />
    </>
  )
}
