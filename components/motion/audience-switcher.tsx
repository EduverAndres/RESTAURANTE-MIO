'use client'

import {
  ArrowRightIcon,
  BikeIcon,
  Building2Icon,
  CalendarCheckIcon,
  ClockIcon,
  CoinsIcon,
  FileTextIcon,
  LayoutDashboardIcon,
  PaletteIcon,
  RadarIcon,
  ReceiptTextIcon,
  ShieldCheckIcon,
  StoreIcon,
  UserRoundIcon,
  UsersIcon,
  WalletIcon,
  type LucideIcon,
} from 'lucide-react'
import Link from 'next/link'
import { useState } from 'react'
import { PillTabsList, PillTabsTrigger } from '@/components/motion/pill-tabs'
import { useHydrated } from '@/components/motion/use-hydrated'
import { Button } from '@/components/ui/button'
import { Tabs, TabsContent } from '@/components/ui/tabs'
import { APP_NAME } from '@/lib/env'
import { BASE_COMMISSION_PCT, PLAN_LABELS } from '@/lib/plans'
import { cn } from '@/lib/utils'

interface Audience {
  value: string
  tab: string
  icon: LucideIcon
  title: string
  text: string
  benefits: readonly { icon: LucideIcon; title: string; text: string }[]
  actions: readonly { href: string; label: string; primary?: boolean }[]
}

/**
 * Every promise below is a rule of the product (docs/PRODUCTO.md) or a
 * feature it ships; none of them is a figure about how well it is doing.
 */
const AUDIENCES: readonly Audience[] = [
  {
    value: 'clientes',
    tab: 'Para ti',
    icon: UserRoundIcon,
    title: 'Pide o reserva en tus lugares de siempre',
    text: 'Los restaurantes y negocios de tu barrio, con su propia marca, a un toque.',
    benefits: [
      {
        icon: BikeIcon,
        title: 'A domicilio, para recoger o en la mesa',
        text: 'Y si estás en el local, escaneas el QR de tu mesa y pides sin crear cuenta.',
      },
      {
        icon: CalendarCheckIcon,
        title: 'Reserva tu mesa en segundos',
        text: 'Eliges personas, día y hora, y el restaurante te confirma.',
      },
      {
        icon: ReceiptTextIcon,
        title: 'El precio de la carta',
        text: 'Pagas eso, el envío y la propina que elijas. Sin recargos ocultos.',
      },
      {
        icon: RadarIcon,
        title: 'Síguelo en vivo',
        text: 'Ves cada paso y lo recibes con un código que solo tú tienes.',
      },
    ],
    actions: [
      { href: '/#restaurantes', label: 'Pedir ahora', primary: true },
      { href: '/reservas', label: 'Reservar mesa' },
    ],
  },
  {
    value: 'empresas',
    tab: 'Empresas',
    icon: Building2Icon,
    title: 'Los domicilios de tu equipo, en una sola cuenta',
    text: 'Almuerzos, reuniones y turnos largos sin recoger facturas una por una.',
    benefits: [
      {
        icon: UsersIcon,
        title: 'Invita a tu equipo',
        text: 'Cada persona pide desde su cuenta, dentro de la de tu empresa.',
      },
      {
        icon: WalletIcon,
        title: 'Presupuestos claros',
        text: 'Defines un tope por persona al mes y otro por pedido.',
      },
      {
        icon: FileTextIcon,
        title: 'Un solo estado de cuenta',
        text: 'Pagas a crédito, una vez al mes, con cada pedido detallado.',
      },
      {
        icon: ReceiptTextIcon,
        title: 'Facturación con NIT',
        text: 'Cada negocio factura a nombre de tu empresa.',
      },
    ],
    actions: [
      {
        href: '/empresas',
        label: 'Conocer la cuenta de empresa',
        primary: true,
      },
    ],
  },
  {
    value: 'restaurantes',
    tab: 'Restaurantes',
    icon: StoreIcon,
    title: 'Tu canal de venta propio, con tu marca',
    text: 'Pedidos, reservas y clientes que vuelven, sin depender de un catálogo ajeno.',
    benefits: [
      {
        icon: PaletteIcon,
        title: 'Tu tienda, con tu marca',
        text: 'Colores, tipografías, portada y un QR para cada mesa.',
      },
      {
        icon: LayoutDashboardIcon,
        title: 'Pedidos y reservas en tiempo real',
        text: `Un tablero para la cocina; las reservas vienen en los planes ${PLAN_LABELS.mediano} y ${PLAN_LABELS.vip}.`,
      },
      {
        icon: Building2Icon,
        title: 'Pedidos de empresas',
        text: `Equipos con cuenta corporativa: facturas al NIT y ${APP_NAME} te liquida.`,
      },
      {
        icon: CoinsIcon,
        title: 'Empieza sin mensualidad',
        text: `Plan ${PLAN_LABELS.normal}: ${BASE_COMMISSION_PCT} % en domicilio y para recoger, 0 % en la mesa.`,
      },
    ],
    actions: [
      {
        href: '/para-restaurantes',
        label: `Vender con ${APP_NAME}`,
        primary: true,
      },
    ],
  },
  {
    value: 'domiciliarios',
    tab: 'Domiciliarios',
    icon: BikeIcon,
    title: 'Gana dinero entregando en tu barrio',
    text: 'Tú decides cuándo te conectas y qué entregas tomas.',
    benefits: [
      {
        icon: CoinsIcon,
        title: 'Domicilio + 100 % de la propina',
        text: 'Ganas el valor del domicilio de cada entrega y toda la propina.',
      },
      {
        icon: ClockIcon,
        title: 'Sin horario',
        text: 'Ni exclusividad: te conectas cuando quieres y eliges tus entregas.',
      },
      {
        icon: ReceiptTextIcon,
        title: 'Liquidación periódica',
        text: 'Con cada entrega, propina y consignación a la vista.',
      },
      {
        icon: ShieldCheckIcon,
        title: 'Aprobación con documentos',
        text: 'Revisamos licencia, SOAT y vencimientos antes de activarte.',
      },
    ],
    actions: [
      { href: '/repartidores', label: 'Quiero repartir', primary: true },
    ],
  },
]

/**
 * "Who is this for?" in one place: four tabs, one panel per audience, each
 * with its own way in.
 *
 * The active tab is marked by a pill that glides between tabs (a shared
 * `layoutId`); with reduced motion Motion drops the glide and the pill just
 * moves (see MotionProvider). Radix owns the tab semantics, the arrow keys
 * and the focus handling.
 *
 * Every panel is in the server HTML (`forceMount`). Until the page has
 * hydrated they all show, stacked, so the content is complete without
 * JavaScript; once it has, only the active one does.
 */
export function AudienceSwitcher() {
  const [active, setActive] = useState(AUDIENCES[0].value)
  const hydrated = useHydrated()

  return (
    <section
      id="para-quien"
      aria-labelledby="para-quien-title"
      className="border-border/60 scroll-mt-24 border-t"
    >
      <div className="container-page py-section space-y-10">
        <div className="reveal max-w-2xl space-y-3">
          <p className="text-primary-on-tint text-xs font-semibold tracking-wide uppercase">
            Para cada quien
          </p>
          <h2
            id="para-quien-title"
            className="text-h1 font-display font-semibold"
          >
            Una app para pedir, vender y entregar
          </h2>
          <p className="text-muted-foreground text-lead">
            Elige quién eres y mira lo que {APP_NAME} hace por ti.
          </p>
        </div>

        <Tabs value={active} onValueChange={setActive} className="gap-8">
          <PillTabsList
            aria-label="¿Quién eres?"
            className="rounded-card sm:rounded-pill grid w-full grid-cols-2 sm:inline-flex sm:w-fit"
          >
            {AUDIENCES.map(({ value, tab, icon: Icon }) => (
              <PillTabsTrigger
                key={value}
                value={value}
                active={active === value}
                layoutId="audience-indicator"
              >
                <Icon aria-hidden="true" className="size-4" />
                {tab}
              </PillTabsTrigger>
            ))}
          </PillTabsList>

          {AUDIENCES.map((audience) => (
            <TabsContent
              key={audience.value}
              value={audience.value}
              forceMount
              className={cn(
                'rounded-card bg-card shadow-1 p-card data-[state=active]:animate-fade-up grid gap-8 text-base lg:grid-cols-[minmax(0,0.85fr)_minmax(0,1.15fr)] lg:gap-12',
                hydrated && 'data-[state=inactive]:hidden',
              )}
            >
              <div className="space-y-4 lg:py-4">
                <h3 className="text-h2 font-display font-semibold">
                  {audience.title}
                </h3>
                <p className="text-muted-foreground text-pretty">
                  {audience.text}
                </p>
                <div className="flex flex-wrap gap-3 pt-2">
                  {audience.actions.map((action) => (
                    <Button
                      key={action.href}
                      asChild
                      size="lg"
                      variant={action.primary ? 'default' : 'outline'}
                      className="rounded-pill h-11 px-5"
                    >
                      <Link href={action.href}>
                        {action.label}
                        {action.primary ? (
                          <ArrowRightIcon
                            aria-hidden="true"
                            data-icon="inline-end"
                          />
                        ) : null}
                      </Link>
                    </Button>
                  ))}
                </div>
              </div>

              <ul className="gap-card grid sm:grid-cols-2">
                {audience.benefits.map(({ icon: Icon, title, text }) => (
                  <li key={title} className="flex gap-3">
                    <span className="rounded-control bg-primary/10 text-primary-on-tint grid size-10 shrink-0 place-items-center">
                      <Icon aria-hidden="true" className="size-5" />
                    </span>
                    <span className="space-y-1">
                      <span className="font-display block text-lg leading-snug font-semibold">
                        {title}
                      </span>
                      <span className="text-muted-foreground block text-sm text-pretty">
                        {text}
                      </span>
                    </span>
                  </li>
                ))}
              </ul>
            </TabsContent>
          ))}
        </Tabs>
      </div>
    </section>
  )
}
