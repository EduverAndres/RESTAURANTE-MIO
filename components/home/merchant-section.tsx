import {
  ArrowRightIcon,
  Building2Icon,
  CalendarCheckIcon,
  LayoutDashboardIcon,
  MegaphoneIcon,
  PaletteIcon,
  WalletIcon,
} from 'lucide-react'
import Link from 'next/link'
import { Marquee } from '@/components/motion/marquee'
import { Button } from '@/components/ui/button'
import { BASE_COMMISSION_PCT, PLAN_LABELS } from '@/lib/plans'

/**
 * The home's handshake with the person who pays: the business owner.
 *
 * Painted as an inverted band — the palette's own ink as the background — so
 * a diner scrolling past reads it as "this part is not for me" in a glance,
 * and an owner reads it as the one part that is. Every promise is a feature
 * of the merchant offer (docs/PRODUCTO.md); the commission comes from
 * lib/plans.ts, the same constant the payouts charge, so the band cannot
 * promise a rate the platform does not apply. The kinds of business that can
 * sell scroll past in a marquee, which stops on hover and with reduced motion
 * becomes a plain list.
 */
const MERCHANT_BENEFITS = [
  {
    title: 'Empieza sin mensualidad',
    description: `Con el plan ${PLAN_LABELS.normal} pagas solo cuando vendes: 0 % en la mesa y ${BASE_COMMISSION_PCT} % en domicilio y para recoger. Haz la cuenta con tus números.`,
    icon: WalletIcon,
  },
  {
    title: 'Pedidos en tiempo real',
    description:
      'Domicilio, para recoger y desde la mesa, en un tablero que la cocina entiende de un vistazo.',
    icon: LayoutDashboardIcon,
  },
  {
    title: 'Reservas de mesa',
    description: `Tus clientes reservan y tú confirmas desde el panel. Incluidas en los planes ${PLAN_LABELS.mediano} y ${PLAN_LABELS.vip}.`,
    icon: CalendarCheckIcon,
  },
  {
    title: 'Pedidos de empresas',
    description:
      'Equipos que piden con cuenta corporativa: facturas al NIT de la empresa y te liquidamos.',
    icon: Building2Icon,
  },
  {
    title: 'Tu tienda, con tu marca',
    description:
      'Tus colores, tu tipografía, tu portada y un QR para cada mesa.',
    icon: PaletteIcon,
  },
  {
    title: 'Destacados patrocinados',
    description:
      'Si quieres más visibilidad, apareces primero pagando por día, marcado como "Patrocinado".',
    icon: MegaphoneIcon,
  },
] as const

const BUSINESSES = [
  'Restaurantes',
  'Comidas rápidas',
  'Panaderías',
  'Repostería',
  'Cafeterías',
  'Farmacias',
  'Minimarkets',
  'Tiendas de barrio',
  'Mascotas',
  'Regalos',
] as const

export function MerchantSection() {
  return (
    <section
      id="para-negocios"
      aria-labelledby="merchant-title"
      className="bg-foreground text-background dark:bg-card dark:text-foreground scroll-mt-24 overflow-hidden"
    >
      <div className="container-page py-section space-y-12">
        <div className="grid gap-12 lg:grid-cols-[minmax(0,0.9fr)_minmax(0,1.1fr)] lg:gap-16">
          <div className="reveal space-y-6 lg:sticky lg:top-28 lg:self-start">
            <p className="text-accent text-xs font-semibold tracking-wide uppercase">
              Para negocios
            </p>
            <h2
              id="merchant-title"
              className="text-h1 font-display font-semibold"
            >
              Vende más, con tu marca y tus propios clientes.
            </h2>
            <p className="text-lead text-background/75 dark:text-muted-foreground text-pretty">
              Pedidos, reservas y pedidos de empresas en un solo panel, en
              tiempo real. Abre tu tienda en una tarde y sin perder el control.
            </p>

            <div className="flex flex-col gap-3 pt-2 sm:flex-row">
              <Button
                asChild
                size="lg"
                className="rounded-pill h-12 px-6 text-base active:scale-[0.98]"
              >
                <Link href="/register?role=merchant">
                  Crear mi tienda
                  <ArrowRightIcon aria-hidden="true" data-icon="inline-end" />
                </Link>
              </Button>
              <Button
                asChild
                size="lg"
                variant="ghost"
                className="rounded-pill text-background hover:bg-background/10 hover:text-background dark:text-foreground dark:hover:bg-foreground/10 h-12 px-6 text-base"
              >
                <Link href="/para-restaurantes">Ver planes y calculadora</Link>
              </Button>
            </div>
          </div>

          <ul className="grid gap-3 sm:grid-cols-2">
            {MERCHANT_BENEFITS.map(({ title, description, icon: Icon }) => (
              <li key={title} className="reveal">
                <div className="rounded-card bg-background/[0.06] dark:bg-foreground/[0.04] p-card h-full ring-1 ring-current/10">
                  <span className="bg-primary text-primary-foreground rounded-control mb-4 grid size-11 place-items-center">
                    <Icon aria-hidden="true" className="size-5" />
                  </span>
                  <h3 className="font-display mb-1.5 text-xl font-semibold">
                    {title}
                  </h3>
                  <p className="text-background/70 dark:text-muted-foreground text-sm text-pretty">
                    {description}
                  </p>
                </div>
              </li>
            ))}
          </ul>
        </div>

        <Marquee label="Negocios que pueden vender" duration={36}>
          {BUSINESSES.map((business) => (
            <li
              key={business}
              className="rounded-pill bg-background/10 text-background/85 dark:bg-foreground/5 dark:text-foreground/85 px-4 py-2 text-sm font-medium whitespace-nowrap ring-1 ring-current/10"
            >
              {business}
            </li>
          ))}
        </Marquee>
      </div>
    </section>
  )
}
