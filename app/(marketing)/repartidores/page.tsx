import {
  ArrowRightIcon,
  BadgeCheckIcon,
  BanknoteIcon,
  CarFrontIcon,
  ChevronDownIcon,
  ClockIcon,
  CoinsIcon,
  FileCheckIcon,
  HandCoinsIcon,
  HeartPulseIcon,
  IdCardIcon,
  ReceiptTextIcon,
  ShieldCheckIcon,
  SmartphoneIcon,
  WrenchIcon,
} from 'lucide-react'
import type { Metadata } from 'next'
import Link from 'next/link'
import { SiteFooter } from '@/components/layout/site-footer'
import { CourierEarningsCalculator } from '@/components/marketing/courier-earnings-calculator'
import { Reveal } from '@/components/motion/reveal'
import { Button } from '@/components/ui/button'
import { APP_NAME } from '@/lib/env'
import {
  averageDeliveryFee,
  defaultCourierEstimate,
} from '@/lib/marketing/courier-earnings'
import { fetchActiveDeliveryFees } from '@/lib/marketing/public-data'

export const metadata: Metadata = {
  title: 'Trabaja como domiciliario',
  description: `Gana dinero entregando en tu barrio con ${APP_NAME}: el valor del domicilio más el 100 % de la propina, sin horario y con liquidación periódica.`,
}

const REGISTER_HREF = '/register?role=courier'

/**
 * The page addressed to couriers.
 *
 * What it promises is the product's rule (docs/PRODUCTO.md): the delivery fee
 * plus 100 % of the tip, settled periodically, after an approval with
 * documents. It never states an income. The only figure is the one the
 * courier builds in the calculator, labelled on the spot as an estimate and
 * not a guarantee, and its starting fee is the real average of the stores
 * that are live (or a labelled example when there is none).
 *
 * The requirements are the ones the Términos para Comercios y Repartidores
 * already impose (app/(public)/(legal)/terminos-aliados), so the page cannot
 * ask for less than the contract does.
 */

const EARNINGS = [
  {
    icon: BanknoteIcon,
    title: 'El valor del domicilio',
    text: 'En cada entrega ganas el domicilio que paga el cliente. Lo fija cada negocio.',
  },
  {
    icon: HandCoinsIcon,
    title: 'El 100 % de la propina',
    text: 'La propina que deja el cliente es toda tuya, sin descuentos.',
  },
  {
    icon: ReceiptTextIcon,
    title: 'Liquidación periódica',
    text: 'Cada liquidación muestra tus entregas, propinas, el efectivo que cobraste y lo que consignaste.',
  },
] as const

const REQUIREMENTS = [
  {
    icon: IdCardIcon,
    title: 'Documento de identidad',
    text: 'Vigente y a tu nombre.',
  },
  {
    icon: CarFrontIcon,
    title: 'Licencia de conducción vigente',
    text: 'De la categoría que corresponde a tu vehículo.',
  },
  {
    icon: ShieldCheckIcon,
    title: 'SOAT vigente',
    text: 'Del vehículo con el que vas a entregar.',
  },
  {
    icon: WrenchIcon,
    title: 'Revisión técnico-mecánica',
    text: 'Al día, cuando tu vehículo la requiera.',
  },
  {
    icon: HeartPulseIcon,
    title: 'Seguridad social',
    text: 'Afiliado y cotizando como trabajador independiente.',
  },
  {
    icon: SmartphoneIcon,
    title: 'Celular con internet',
    text: 'Para ver las entregas y mostrar el avance al cliente mientras entregas.',
  },
] as const

const STEPS = [
  {
    title: 'Regístrate',
    text: 'Crea tu cuenta de domiciliario con tu correo. Toma un par de minutos.',
  },
  {
    title: 'Completa tu perfil',
    text: 'Tu vehículo, la placa y las fechas de vencimiento de la licencia y el SOAT.',
  },
  {
    title: 'Aprobación del equipo',
    text: `El equipo de ${APP_NAME} revisa tus datos y documentos y activa tu cuenta.`,
  },
  {
    title: 'Toma entregas cuando quieras',
    text: 'Te conectas, ves las entregas disponibles y tomas las que te sirvan.',
  },
] as const

const FAQ = [
  {
    question: '¿Cuánto gano por entrega?',
    answer:
      'El valor del domicilio de ese pedido, que fija cada negocio, más el 100 % de la propina que deje el cliente. La calculadora te ayuda a estimarlo, pero no es una garantía: depende de los pedidos que haya y de los que tomes.',
  },
  {
    question: '¿Tengo horario o exclusividad?',
    answer:
      'No. Prestas el servicio de forma independiente: decides cuándo conectarte y qué entregas aceptar.',
  },
  {
    question: '¿Cuándo y cómo me pagan?',
    answer:
      'Con liquidaciones periódicas. En cada una ves tus entregas, las propinas, el efectivo que cobraste y lo que consignaste.',
  },
  {
    question: '¿Qué pasa con el efectivo que cobro?',
    answer:
      'Es de los negocios: queda registrado en tu cuenta y lo saldas consignando. Hay un tope de efectivo; si lo alcanzas, no puedes tomar más pedidos en efectivo hasta consignar. Los pagados en línea los sigues tomando.',
  },
  {
    question: `¿Soy empleado de ${APP_NAME}?`,
    answer:
      'No. La relación es independiente y autónoma, como dicen los Términos para Comercios y Repartidores. Por eso te pedimos estar afiliado a la seguridad social como independiente.',
  },
  {
    question: '¿Qué revisa el equipo antes de aprobarme?',
    answer:
      'Que tu perfil esté completo y tus documentos al día, con sus fechas de vencimiento. Si un documento vence, no puedes tomar entregas hasta que lo actualices.',
  },
] as const

export default async function CourierLandingPage() {
  const fees = await fetchActiveDeliveryFees()
  const realAverage = averageDeliveryFee(fees)
  const initial = defaultCourierEstimate(realAverage)

  return (
    <>
      <section className="brand-mesh border-border/60 border-b">
        <div className="container-page py-section grid items-center gap-10 lg:grid-cols-[minmax(0,1.1fr)_minmax(0,0.9fr)] lg:gap-14">
          {/* No entrance animation: the headline is this page's largest
              paint and is in the HTML at full opacity. */}
          <div className="space-y-6">
            <p className="text-primary-on-tint text-xs font-semibold tracking-wide uppercase">
              Domiciliarios
            </p>
            <h1 className="text-display font-display font-display-soft font-semibold">
              Gana dinero entregando{' '}
              <span className="text-primary">en tu barrio</span>.
            </h1>
            <p className="text-muted-foreground text-lead max-w-xl">
              Ganas el valor del domicilio y el 100 % de la propina de cada
              entrega. Tú decides cuándo te conectas y qué pedidos tomas.
            </p>
            <div className="flex flex-col gap-3 sm:flex-row">
              <Button
                asChild
                size="lg"
                className="rounded-pill h-12 px-6 text-base"
              >
                <Link href={REGISTER_HREF}>
                  Quiero repartir
                  <ArrowRightIcon aria-hidden="true" data-icon="inline-end" />
                </Link>
              </Button>
              <Button
                asChild
                size="lg"
                variant="outline"
                className="rounded-pill h-12 px-6 text-base"
              >
                <Link href="#calculadora">Calcular lo que ganarías</Link>
              </Button>
            </div>
            <ul className="flex flex-wrap gap-2 pt-1 text-sm">
              {[
                { icon: CoinsIcon, label: 'Domicilio + 100 % de la propina' },
                { icon: ClockIcon, label: 'Sin horario' },
                { icon: BadgeCheckIcon, label: 'Aprobación con documentos' },
              ].map(({ icon: Icon, label }) => (
                <li
                  key={label}
                  className="rounded-pill bg-card shadow-1 inline-flex items-center gap-2 px-3 py-1.5"
                >
                  <Icon aria-hidden="true" className="text-primary size-4" />
                  {label}
                </li>
              ))}
            </ul>
          </div>

          {/* What one delivery is made of, as a receipt. No amounts: the
              fee is each store's and the tip is each customer's. */}
          <div aria-hidden="true" className="mx-auto w-full max-w-sm">
            <div className="rounded-card bg-card shadow-3 motion-safe:animate-float space-y-5 p-6">
              <div className="flex items-center justify-between">
                <span className="font-display text-xl font-semibold">
                  Tu entrega
                </span>
                <span className="rounded-pill bg-success/12 text-success-on-tint px-2.5 py-0.5 text-xs font-semibold">
                  Entregado
                </span>
              </div>
              <div className="space-y-3 text-sm">
                <div className="flex items-center justify-between gap-3">
                  <span className="text-muted-foreground">
                    Valor del domicilio
                  </span>
                  <span className="font-semibold">Para ti</span>
                </div>
                <div className="flex items-center justify-between gap-3">
                  <span className="text-muted-foreground">Propina</span>
                  <span className="font-semibold">100 % para ti</span>
                </div>
                <div className="reveal-line bg-border h-px w-full" />
                <div className="flex items-center justify-between gap-3">
                  <span className="text-muted-foreground">Se liquida</span>
                  <span className="font-semibold">Periódicamente</span>
                </div>
              </div>
              <div className="bg-secondary/70 text-muted-foreground flex items-center gap-2 rounded-xl px-3 py-2 text-xs">
                <FileCheckIcon className="text-primary-on-tint size-4" />
                Cada entrega queda en tu cuenta, con su detalle.
              </div>
            </div>
          </div>
        </div>
      </section>

      <section
        id="ganancias"
        aria-labelledby="ganancias-title"
        className="scroll-mt-24"
      >
        <div className="container-page py-section space-y-10">
          <Reveal className="max-w-2xl space-y-3">
            <p className="text-primary-on-tint text-xs font-semibold tracking-wide uppercase">
              Cómo ganas
            </p>
            <h2
              id="ganancias-title"
              className="text-h1 font-display font-semibold"
            >
              Cuentas claras en cada entrega
            </h2>
          </Reveal>
          <ul className="gap-card grid md:grid-cols-3">
            {EARNINGS.map(({ icon: Icon, title, text }) => (
              <Reveal
                as="li"
                key={title}
                className="rounded-card bg-card shadow-1 p-card space-y-3"
              >
                <span className="rounded-control bg-primary/10 text-primary-on-tint grid size-12 place-items-center">
                  <Icon aria-hidden="true" className="size-6" />
                </span>
                <h3 className="font-display text-xl font-semibold">{title}</h3>
                <p className="text-muted-foreground text-sm text-pretty">
                  {text}
                </p>
              </Reveal>
            ))}
          </ul>
        </div>
      </section>

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
              Entregas por día por lo que ganas en cada una (domicilio más
              propina), por los días que trabajes.
            </p>
          </Reveal>
          <CourierEarningsCalculator
            initial={initial}
            usesRealAverage={realAverage !== null}
          />
        </div>
      </section>

      <section
        id="requisitos"
        aria-labelledby="requisitos-title"
        className="border-border/60 scroll-mt-24 border-t"
      >
        <div className="container-page py-section space-y-10">
          <Reveal className="max-w-2xl space-y-3">
            <p className="text-primary-on-tint text-xs font-semibold tracking-wide uppercase">
              Requisitos
            </p>
            <h2
              id="requisitos-title"
              className="text-h1 font-display font-semibold"
            >
              Lo que necesitas para empezar
            </h2>
            <p className="text-muted-foreground text-pretty">
              Son los mismos que piden los{' '}
              <Link
                href="/terminos-aliados"
                className="text-foreground font-medium underline underline-offset-4"
              >
                Términos para Comercios y Repartidores
              </Link>
              .
            </p>
          </Reveal>
          <ul className="gap-card grid sm:grid-cols-2 lg:grid-cols-3">
            {REQUIREMENTS.map(({ icon: Icon, title, text }) => (
              <Reveal as="li" key={title} className="flex gap-4">
                <span className="rounded-control bg-primary/10 text-primary-on-tint grid size-11 shrink-0 place-items-center">
                  <Icon aria-hidden="true" className="size-5" />
                </span>
                <span className="space-y-1">
                  <span className="font-display block text-lg font-semibold">
                    {title}
                  </span>
                  <span className="text-muted-foreground block text-sm text-pretty">
                    {text}
                  </span>
                </span>
              </Reveal>
            ))}
          </ul>
        </div>
      </section>

      <section
        id="pasos"
        aria-labelledby="pasos-title"
        className="border-border/60 bg-card scroll-mt-24 border-t"
      >
        <div className="container-page py-section space-y-10">
          <Reveal className="max-w-2xl space-y-3">
            <p className="text-primary-on-tint text-xs font-semibold tracking-wide uppercase">
              Paso a paso
            </p>
            <h2 id="pasos-title" className="text-h1 font-display font-semibold">
              De la inscripción a tu primera entrega
            </h2>
          </Reveal>
          <ol className="gap-card grid sm:grid-cols-2 lg:grid-cols-4">
            {STEPS.map((step, index) => (
              <Reveal as="li" key={step.title} className="space-y-3">
                <span
                  aria-hidden="true"
                  className="bg-primary text-primary-foreground font-display grid size-12 place-items-center rounded-full text-xl font-semibold tabular-nums"
                >
                  {index + 1}
                </span>
                <h3 className="font-display text-xl font-semibold">
                  <span className="sr-only">Paso {index + 1}: </span>
                  {step.title}
                </h3>
                <p className="text-muted-foreground text-sm text-pretty">
                  {step.text}
                </p>
              </Reveal>
            ))}
          </ol>

          <Reveal className="rounded-card bg-accent/15 flex flex-col gap-4 p-6 sm:flex-row sm:items-start">
            <span className="bg-card text-accent-strong rounded-control grid size-11 shrink-0 place-items-center">
              <BanknoteIcon aria-hidden="true" className="size-5" />
            </span>
            <div className="space-y-1.5">
              <h3 className="font-display text-xl font-semibold">
                Pedidos en efectivo
              </h3>
              <p className="text-foreground/80 text-sm text-pretty">
                Cuando el cliente paga en efectivo, cobras tú. Ese dinero es de
                los negocios: queda registrado en tu cuenta y lo saldas
                consignando. Hay un tope de efectivo: si lo alcanzas, no puedes
                tomar más pedidos en efectivo hasta que consignes, y los pagados
                en línea los sigues tomando.
              </p>
            </div>
          </Reveal>
        </div>
      </section>

      <section
        id="preguntas"
        aria-labelledby="preguntas-title"
        className="border-border/60 scroll-mt-24 border-t"
      >
        <div className="container-page py-section grid gap-10 lg:grid-cols-[minmax(0,0.8fr)_minmax(0,1.2fr)]">
          <Reveal className="space-y-3">
            <h2
              id="preguntas-title"
              className="text-h1 font-display font-semibold"
            >
              Preguntas frecuentes
            </h2>
            <p className="text-muted-foreground text-pretty">
              Lo que más nos preguntan antes de inscribirse.
            </p>
          </Reveal>
          <div className="space-y-3">
            {FAQ.map(({ question, answer }) => (
              <details
                key={question}
                className="group rounded-card bg-card shadow-1 open:shadow-2"
              >
                <summary className="flex min-h-11 cursor-pointer list-none items-center justify-between gap-4 px-5 py-4 font-medium [&::-webkit-details-marker]:hidden">
                  {question}
                  <ChevronDownIcon
                    aria-hidden="true"
                    className="text-muted-foreground size-5 shrink-0 transition-transform duration-200 group-open:rotate-180"
                  />
                </summary>
                <p className="text-muted-foreground px-5 pb-5 text-sm text-pretty">
                  {answer}
                </p>
              </details>
            ))}
          </div>
        </div>
      </section>

      <section className="border-border/60 bg-foreground text-background dark:bg-card dark:text-foreground border-t">
        <div className="container-page py-section">
          <Reveal className="mx-auto max-w-2xl space-y-5 text-center">
            <h2 className="text-h1 font-display font-semibold text-balance">
              ¿Arrancamos?
            </h2>
            <p className="text-background/75 dark:text-muted-foreground text-pretty">
              Regístrate, completa tu perfil y, en cuanto el equipo lo apruebe,
              empieza a tomar entregas en tu barrio.
            </p>
            <div className="flex justify-center pt-2">
              <Button
                asChild
                size="lg"
                className="rounded-pill h-12 px-6 text-base"
              >
                <Link href={REGISTER_HREF}>
                  Quiero repartir
                  <ArrowRightIcon aria-hidden="true" data-icon="inline-end" />
                </Link>
              </Button>
            </div>
          </Reveal>
        </div>
      </section>

      <SiteFooter />
    </>
  )
}
