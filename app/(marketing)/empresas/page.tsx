import {
  ArrowRightIcon,
  BadgeCheckIcon,
  CalendarClockIcon,
  ChevronDownIcon,
  FileTextIcon,
  LinkIcon,
  ReceiptTextIcon,
  ShieldCheckIcon,
  UsersIcon,
  WalletIcon,
} from 'lucide-react'
import type { Metadata } from 'next'
import Link from 'next/link'
import { SiteFooter } from '@/components/layout/site-footer'
import { CompanyBudgetCalculator } from '@/components/marketing/company-budget-calculator'
import { Reveal } from '@/components/motion/reveal'
import { Button } from '@/components/ui/button'
import { APP_NAME } from '@/lib/env'

export const metadata: Metadata = {
  title: 'Cuenta de empresa',
  description: `Comida para tu equipo con ${APP_NAME}: presupuesto por persona, un estado de cuenta al mes a crédito y facturas a nombre de tu empresa.`,
}

const REGISTER_HREF = '/empresa/registro'

/**
 * The page addressed to companies.
 *
 * It promises what the product does (docs/PRODUCTO.md): invited employees,
 * a budget per person and per order, one monthly statement on credit and
 * invoices to the company's NIT. No customer logos, no figures: the only
 * number is the one the visitor builds in the calculator, labelled as an
 * estimate, and the credit line is always "approved by Cerquita".
 */

const BENEFITS = [
  {
    icon: WalletIcon,
    title: 'Presupuesto por persona',
    text: 'Le pones a cada persona un tope al mes y otro por pedido. Nadie gasta de más.',
  },
  {
    icon: CalendarClockIcon,
    title: 'Un estado de cuenta al mes',
    text: 'Todo lo que pidió tu equipo en un solo documento, a crédito, con el plazo que acordemos.',
  },
  {
    icon: FileTextIcon,
    title: 'Facturas a tu NIT',
    text: 'Cada restaurante factura a la razón social y al NIT de tu empresa.',
  },
  {
    icon: LinkIcon,
    title: 'Invitas con un enlace',
    text: 'Lo compartes por WhatsApp o correo. Tu equipo se une con su cuenta de siempre.',
  },
  {
    icon: ReceiptTextIcon,
    title: 'Cada pedido con su motivo',
    text: 'Quién pidió, dónde, cuánto y para qué: el motivo o centro de costo va en cada pedido.',
  },
  {
    icon: ShieldCheckIcon,
    title: 'Precio de la carta',
    text: 'Sin recargos ocultos por pagar con la empresa. Pagas el pedido, el domicilio y la propina que cubras.',
  },
] as const

const STEPS = [
  {
    title: 'Registra tu empresa',
    text: 'Con el NIT y los datos de facturación. Toma un par de minutos.',
  },
  {
    title: 'Aprobamos el cupo',
    text: `El equipo de ${APP_NAME} revisa la empresa y aprueba un cupo, un plazo de pago y la propina que cubres.`,
  },
  {
    title: 'Invita a tu equipo',
    text: 'Con un enlace, y a cada persona le asignas su presupuesto.',
  },
  {
    title: 'Piden y la empresa paga',
    text: 'Al pagar eligen «Cuenta de empresa». Al cerrar el mes recibes el estado de cuenta.',
  },
] as const

const FAQ = [
  {
    question: '¿Cuánto cuesta la cuenta de empresa?',
    answer:
      'Registrarla no tiene costo. Pagas lo que tu equipo pida: el precio de la carta, el domicilio y la propina, hasta el tope de propina que definas.',
  },
  {
    question: '¿Cómo se aprueba el crédito?',
    answer: `El equipo de ${APP_NAME} revisa los datos de tu empresa y aprueba un cupo y un plazo de pago (de 15 a 60 días). Mientras la cuenta está en revisión puedes invitar a tu equipo, pero nadie puede pagar con ella.`,
  },
  {
    question: '¿Cuándo y cómo se paga?',
    answer:
      'Al cerrar cada mes recibes un estado de cuenta con todos los pedidos entregados. Lo pagas dentro del plazo acordado con la referencia que trae.',
  },
  {
    question: '¿Qué pasa si un estado de cuenta se vence?',
    answer:
      'La cuenta se pausa: tu equipo no puede pagar con ella hasta que el estado de cuenta se pague. Los pedidos ya hechos siguen su curso.',
  },
  {
    question: '¿Quién factura los pedidos?',
    answer:
      'Cada restaurante es el vendedor y factura a la razón social y al NIT de tu empresa. El estado de cuenta de Cerquita reúne lo que tu equipo cargó a la cuenta en el mes.',
  },
  {
    question: '¿Qué pasa con cancelaciones y reembolsos?',
    answer:
      'Un pedido cancelado no se cobra y devuelve el cupo al instante. Si un pedido entregado se reembolsa, el valor queda como abono en el siguiente estado de cuenta.',
  },
  {
    question: '¿Mi equipo puede usar cupones y premios?',
    answer:
      'Los cupones de los restaurantes sí aplican y bajan lo que paga tu empresa. Los premios de sellos y los créditos por invitación son personales y no se usan en pedidos de empresa.',
  },
] as const

export default function CompaniesLandingPage() {
  return (
    <>
      <section className="brand-mesh border-border/60 border-b">
        <div className="container-page py-section grid items-center gap-10 lg:grid-cols-[minmax(0,1.1fr)_minmax(0,0.9fr)] lg:gap-14">
          {/* No entrance animation: the headline is this page's largest
              paint and is in the HTML at full opacity. */}
          <div className="space-y-6">
            <p className="text-primary-on-tint text-xs font-semibold tracking-wide uppercase">
              Empresas
            </p>
            <h1 className="text-display font-display font-display-soft font-semibold">
              La comida de tu equipo,{' '}
              <span className="text-primary">en una sola cuenta</span>.
            </h1>
            <p className="text-muted-foreground text-lead max-w-xl">
              Tu equipo pide a los restaurantes del barrio y la empresa paga con
              un estado de cuenta al mes, a crédito. Tú pones el presupuesto de
              cada persona.
            </p>
            <div className="flex flex-col gap-3 sm:flex-row">
              <Button
                asChild
                size="lg"
                className="rounded-pill h-12 px-6 text-base"
              >
                <Link href={REGISTER_HREF}>
                  Crear cuenta de empresa
                  <ArrowRightIcon aria-hidden="true" data-icon="inline-end" />
                </Link>
              </Button>
              <Button
                asChild
                size="lg"
                variant="outline"
                className="rounded-pill h-12 px-6 text-base"
              >
                <Link href="#calculadora">Calcular el presupuesto</Link>
              </Button>
            </div>
            <ul className="flex flex-wrap gap-2 pt-1 text-sm">
              {[
                { icon: UsersIcon, label: 'Presupuesto por persona' },
                { icon: CalendarClockIcon, label: 'Crédito mensual' },
                { icon: BadgeCheckIcon, label: 'Facturas a tu NIT' },
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

          {/* A statement, drawn. No amounts and no company names: it shows
              the shape of what arrives each month, not a promise. */}
          <div aria-hidden="true" className="mx-auto w-full max-w-sm">
            <div className="rounded-card bg-card shadow-3 motion-safe:animate-float space-y-5 p-6">
              <div className="flex items-center justify-between">
                <span className="font-display text-xl font-semibold">
                  Estado de cuenta
                </span>
                <span className="rounded-pill bg-primary/10 text-primary-on-tint px-2.5 py-0.5 text-xs font-semibold">
                  Mensual
                </span>
              </div>
              <div className="space-y-3 text-sm">
                <div className="flex items-center justify-between gap-3">
                  <span className="text-muted-foreground">
                    Pedidos del equipo
                  </span>
                  <span className="font-semibold">Uno por línea</span>
                </div>
                <div className="flex items-center justify-between gap-3">
                  <span className="text-muted-foreground">
                    Motivo o centro de costo
                  </span>
                  <span className="font-semibold">En cada pedido</span>
                </div>
                <div className="flex items-center justify-between gap-3">
                  <span className="text-muted-foreground">Reembolsos</span>
                  <span className="font-semibold">Como abono</span>
                </div>
                <div className="reveal-line bg-border h-px w-full" />
                <div className="flex items-center justify-between gap-3">
                  <span className="text-muted-foreground">Se paga</span>
                  <span className="font-semibold">En el plazo acordado</span>
                </div>
              </div>
              <div className="bg-secondary/70 text-muted-foreground flex items-center gap-2 rounded-xl px-3 py-2 text-xs">
                <FileTextIcon className="text-primary-on-tint size-4" />
                Cada restaurante factura a tu NIT.
              </div>
            </div>
          </div>
        </div>
      </section>

      <section
        id="beneficios"
        aria-labelledby="beneficios-title"
        className="scroll-mt-24"
      >
        <div className="container-page py-section space-y-10">
          <Reveal className="max-w-2xl space-y-3">
            <p className="text-primary-on-tint text-xs font-semibold tracking-wide uppercase">
              Por qué con {APP_NAME}
            </p>
            <h2
              id="beneficios-title"
              className="text-h1 font-display font-semibold"
            >
              Control para ti, libertad para tu equipo
            </h2>
          </Reveal>
          <ul className="gap-card grid sm:grid-cols-2 lg:grid-cols-3">
            {BENEFITS.map(({ icon: Icon, title, text }) => (
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
              De la solicitud al primer almuerzo
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
              ¿Cuánto presupuesto necesitas?
            </h2>
            <p className="text-muted-foreground text-pretty">
              Personas por pedidos a la semana por lo que cuesta cada pedido, en
              un mes. Y el cupo que cubriría ese mes mientras pagas el anterior.
            </p>
          </Reveal>
          <CompanyBudgetCalculator />
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
              Crédito y facturación
            </h2>
            <p className="text-muted-foreground text-pretty">
              Lo que más nos preguntan antes de abrir la cuenta. Todo está en
              los{' '}
              <Link
                href="/terminos-empresas"
                className="text-foreground font-medium underline underline-offset-4"
              >
                Términos para Empresas
              </Link>
              .
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
              Abre la cuenta de tu empresa
            </h2>
            <p className="text-background/75 dark:text-muted-foreground text-pretty">
              Regístrala hoy; en cuanto aprobemos el cupo, tu equipo puede
              empezar a pedir.
            </p>
            <div className="flex justify-center pt-2">
              <Button
                asChild
                size="lg"
                className="rounded-pill h-12 px-6 text-base"
              >
                <Link href={REGISTER_HREF}>
                  Crear cuenta de empresa
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
