import {
  BellRingIcon,
  CalendarCheck2Icon,
  CalendarDaysIcon,
  StoreIcon,
  UsersIcon,
} from 'lucide-react'
import type { Metadata } from 'next'
import Link from 'next/link'
import { SiteFooter } from '@/components/layout/site-footer'
import { Reveal } from '@/components/motion/reveal'
import { StoreCard } from '@/components/store/store-card'
import { Button } from '@/components/ui/button'
import { EmptyState } from '@/components/ui/empty-state'
import { APP_NAME } from '@/lib/env'
import { fetchReservableStores } from '@/lib/reservations/directory'

export const dynamic = 'force-dynamic'

export const metadata: Metadata = {
  title: 'Reserva tu mesa',
  description: `Reserva mesa en los restaurantes de Barranquilla con ${APP_NAME}: elige día, hora y personas, y el restaurante te confirma al instante. Sin costo.`,
}

const STEPS = [
  {
    icon: UsersIcon,
    title: 'Elige día, hora y personas',
    text: 'Ves solo las horas con cupo, dentro del horario del restaurante.',
  },
  {
    icon: BellRingIcon,
    title: 'El restaurante confirma',
    text: 'Le llega tu solicitud al instante y te avisamos apenas responda.',
  },
  {
    icon: CalendarCheck2Icon,
    title: 'Llegas y te sientas',
    text: 'Tu reserva queda en Mis reservas, con su código y cómo llegar.',
  },
] as const

const FAQ = [
  {
    q: '¿Reservar tiene algún costo?',
    a: 'No. Reservar es gratis y no te pedimos pago anticipado.',
  },
  {
    q: '¿Cómo sé que mi mesa está confirmada?',
    a: 'Cuando el restaurante confirma, la reserva cambia a «Confirmada» en Mis reservas y, si activaste las notificaciones, te llega un aviso.',
  },
  {
    q: '¿Puedo cancelar?',
    a: 'Sí, desde Mis reservas, en cualquier momento antes de la hora. El restaurante libera la mesa para otras personas.',
  },
  {
    q: '¿Y si somos un grupo grande?',
    a: 'Cada restaurante define cuántas personas acepta por reserva en línea. Para grupos más grandes, escríbele directamente.',
  },
] as const

/**
 * The reservation directory: every restaurant that takes bookings right now,
 * and how booking works. Lists only real, active stores; nothing invented.
 */
export default async function ReservationsDirectoryPage() {
  const stores = await fetchReservableStores()

  return (
    <>
      <section className="border-border/60 border-b">
        <div className="container-page space-y-5 py-12 sm:py-16">
          <p className="text-primary-on-tint text-xs font-semibold tracking-wide uppercase">
            Reservas
          </p>
          {/* The page's largest paint: no entrance animation. */}
          <h1 className="text-display font-display font-display-soft max-w-3xl font-semibold">
            Tu mesa, <span className="text-primary">apartada</span> en segundos.
          </h1>
          <p className="text-muted-foreground text-lead max-w-2xl">
            Elige el restaurante, el día, la hora y cuántos van. El restaurante
            confirma tu reserva y te avisamos al instante. Sin costo.
          </p>
          <div className="flex flex-wrap gap-3">
            <Button asChild size="lg" className="rounded-pill h-12 px-6">
              <a href="#restaurantes-con-reservas">
                <CalendarDaysIcon aria-hidden="true" data-icon="inline-start" />
                Ver restaurantes
              </a>
            </Button>
            <Button
              asChild
              size="lg"
              variant="outline"
              className="rounded-pill h-12 px-6"
            >
              <Link href="/account/reservas">Mis reservas</Link>
            </Button>
          </div>
        </div>
      </section>

      <section
        id="restaurantes-con-reservas"
        aria-labelledby="directorio-title"
        className="container-page scroll-mt-24 py-10 lg:py-14"
      >
        <h2
          id="directorio-title"
          className="text-h2 font-display mb-6 font-semibold"
        >
          {stores.length > 0
            ? `${stores.length} restaurante${stores.length === 1 ? '' : 's'} con reservas`
            : 'Restaurantes con reservas'}
        </h2>
        {stores.length > 0 ? (
          <ul className="grid gap-5 sm:grid-cols-2 lg:grid-cols-3">
            {stores.map((store) => (
              <li key={store.id} className="space-y-3">
                <StoreCard store={store} />
                <Button asChild className="rounded-pill h-11 w-full">
                  <Link href={`/t/${store.slug}/reservar`}>
                    <CalendarDaysIcon
                      aria-hidden="true"
                      data-icon="inline-start"
                    />
                    Reservar en {store.name}
                  </Link>
                </Button>
              </li>
            ))}
          </ul>
        ) : (
          <EmptyState
            illustration="table"
            title="Pronto podrás reservar aquí"
            description="Los restaurantes de Cerquita están activando sus reservas. Mientras tanto, pide a domicilio o para recoger."
            action={
              <Button asChild className="rounded-pill">
                <Link href="/#restaurantes">Ver restaurantes</Link>
              </Button>
            }
          />
        )}
      </section>

      <section
        aria-labelledby="como-reservar"
        className="bg-secondary/40 border-border/60 border-y"
      >
        <div className="container-page py-section space-y-8">
          <h2 id="como-reservar" className="text-h2 font-display font-semibold">
            Cómo funciona
          </h2>
          <ol className="grid gap-5 md:grid-cols-3">
            {STEPS.map((step, index) => (
              <Reveal
                as="li"
                key={step.title}
                className="rounded-card bg-card shadow-1 p-card space-y-3"
              >
                <span className="bg-primary/10 text-primary-on-tint flex size-11 items-center justify-center rounded-full">
                  <step.icon aria-hidden="true" className="size-5" />
                </span>
                <h3 className="font-display text-lg font-semibold">
                  <span className="sr-only">Paso {index + 1}: </span>
                  {step.title}
                </h3>
                <p className="text-muted-foreground text-sm">{step.text}</p>
              </Reveal>
            ))}
          </ol>
        </div>
      </section>

      <section
        aria-labelledby="preguntas-reservas"
        className="container-page py-section grid gap-10 lg:grid-cols-[1fr_1fr]"
      >
        <div className="space-y-3">
          <h2
            id="preguntas-reservas"
            className="text-h2 font-display font-semibold"
          >
            Preguntas frecuentes
          </h2>
          <div className="divide-border divide-y">
            {FAQ.map((item) => (
              <details key={item.q} className="group py-4">
                <summary className="cursor-pointer font-medium">
                  {item.q}
                </summary>
                <p className="text-muted-foreground mt-2 text-sm">{item.a}</p>
              </details>
            ))}
          </div>
        </div>
        <Reveal className="rounded-card bg-foreground text-background p-card space-y-4 self-start">
          <StoreIcon aria-hidden="true" className="size-6" />
          <h2 className="font-display text-2xl font-semibold">
            ¿Tienes un restaurante?
          </h2>
          <p className="text-background/80 text-sm">
            Recibe reservas en tu panel, confírmalas con un toque y sabe cuántas
            personas llegan hoy. Incluido en los planes Mediano y VIP.
          </p>
          <Button asChild variant="secondary" className="rounded-pill">
            <Link href="/para-restaurantes">Conocer los planes</Link>
          </Button>
        </Reveal>
      </section>

      <SiteFooter />
    </>
  )
}
