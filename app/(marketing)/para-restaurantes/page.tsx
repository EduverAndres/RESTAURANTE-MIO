import { ArrowRightIcon } from 'lucide-react'
import type { Metadata } from 'next'
import Link from 'next/link'
import { SiteFooter } from '@/components/layout/site-footer'
import {
  ForRestaurants,
  MERCHANT_REGISTER_HREF,
} from '@/components/marketing/for-restaurants'
import { MerchantFeatures } from '@/components/marketing/merchant-features'
import { PlansSection } from '@/components/marketing/plans-section'
import { SavingsCalculator } from '@/components/marketing/savings-calculator'
import { Reveal } from '@/components/motion/reveal'
import { Button } from '@/components/ui/button'
import { APP_NAME } from '@/lib/env'
import {
  fetchAdPlacements,
  fetchDemoStoreSlug,
} from '@/lib/marketing/public-data'
import { BASE_COMMISSION_PCT } from '@/lib/plans'

export const metadata: Metadata = {
  title: `${APP_NAME} · El canal propio de tu restaurante`,
  description: `Recibe pedidos a domicilio, para recoger y desde la mesa, reservas y pedidos de empresas con tu propia marca. Empieza sin mensualidad: 0 % en la mesa y ${BASE_COMMISSION_PCT} % en domicilio.`,
}

/**
 * The page addressed to the person who pays: the restaurant owner.
 *
 * It lives on its own route rather than at the bottom of the diner home.
 * A diner has no business reading a commission calculator, and an owner
 * reading it does not want a bottom tab bar inviting them to order sushi.
 * The two audiences still meet: "Ver una tienda de verdad" sends the owner
 * to a real, active storefront — read from the database, hidden when there
 * is none — which is the strongest argument the product has.
 */

const STEPS = [
  {
    title: 'Arma tu carta',
    body: 'Categorías, productos, fotos y opciones. Los cambios se publican al instante.',
  },
  {
    title: 'Elige tu estilo',
    body: 'Colores, tipografías y portada. Tu tienda se ve como tu negocio, no como un catálogo ajeno.',
  },
  {
    title: 'Imprime los QR',
    body: 'Uno por mesa. El cliente escanea, pide desde su celular y la cocina lo ve al instante.',
  },
] as const

export default async function OwnerLandingPage() {
  const [demoSlug, adPlacements] = await Promise.all([
    fetchDemoStoreSlug(),
    fetchAdPlacements(),
  ])

  return (
    <>
      <ForRestaurants standalone demoSlug={demoSlug} />

      <MerchantFeatures adPlacements={adPlacements} />

      <section
        id="calculadora"
        aria-labelledby="calculadora-title"
        className="border-border/60 bg-secondary/40 scroll-mt-24 border-t"
      >
        <div className="container-page py-section space-y-8">
          <Reveal className="max-w-2xl space-y-3">
            <h2
              id="calculadora-title"
              className="text-h1 font-display font-semibold"
            >
              Haz la cuenta con tus números
            </h2>
            <p className="text-muted-foreground text-pretty">
              No vamos a adivinar cuánto te cobran. Ponlo tú, que lo sabes mejor
              que nadie.
            </p>
          </Reveal>
          <SavingsCalculator />
        </div>
      </section>

      <PlansSection />

      <section
        aria-labelledby="empezar-title"
        className="border-border/60 border-t"
      >
        <div className="container-page py-section space-y-8">
          <Reveal
            as="h2"
            id="empezar-title"
            className="text-h1 font-display font-semibold"
          >
            Empezar toma una tarde
          </Reveal>
          <ol className="gap-card grid md:grid-cols-3">
            {STEPS.map((step, index) => (
              <Reveal
                as="li"
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
                  <span className="sr-only">Paso {index + 1}: </span>
                  {step.title}
                </h3>
                <p className="text-muted-foreground text-sm text-pretty">
                  {step.body}
                </p>
              </Reveal>
            ))}
          </ol>
        </div>
      </section>

      <section
        aria-labelledby="probar-title"
        className="border-border/60 bg-secondary/40 border-t"
      >
        <div className="container-page py-section">
          <Reveal className="mx-auto max-w-2xl space-y-4 text-center">
            <h2
              id="probar-title"
              className="text-h1 font-display font-semibold text-balance"
            >
              ¿Lo probamos con tu carta?
            </h2>
            <p className="text-muted-foreground text-pretty">
              Arma tu tienda y mírala funcionando. Si no te convence, solo
              perdiste una tarde.
            </p>
            <div className="flex flex-col justify-center gap-3 pt-2 sm:flex-row">
              <Button
                asChild
                size="lg"
                className="rounded-pill h-12 px-6 text-base"
              >
                <Link href={MERCHANT_REGISTER_HREF}>
                  Crear mi tienda
                  <ArrowRightIcon aria-hidden="true" data-icon="inline-end" />
                </Link>
              </Button>
              {demoSlug ? (
                <Button
                  asChild
                  size="lg"
                  variant="outline"
                  className="rounded-pill h-12 px-6 text-base"
                >
                  <Link href={`/t/${demoSlug}`}>Ver una tienda de verdad</Link>
                </Button>
              ) : null}
            </div>
          </Reveal>
        </div>
      </section>

      <SiteFooter />
    </>
  )
}
