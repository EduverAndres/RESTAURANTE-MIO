import {
  ArrowRightIcon,
  BarChart3Icon,
  MapPinIcon,
  PaletteIcon,
  SlidersHorizontalIcon,
  WalletIcon,
} from 'lucide-react'
import Link from 'next/link'
import { FadeIn } from '@/components/motion/fade-in'
import { Button } from '@/components/ui/button'

/**
 * The home's handshake with the person who pays: the business owner.
 *
 * Painted as an inverted band — the palette's own ink as the background — so
 * a diner scrolling past reads it as "this part is not for me" in a glance,
 * and an owner reads it as the one part that is. Every promise points at
 * something the merchant dashboard already has; the pricing line repeats the
 * `/para-restaurantes` offer, whose calculator lets them check it.
 */
const MERCHANT_BENEFITS = [
  {
    title: 'Menores comisiones',
    description:
      'Una mensualidad fija en lugar de un porcentaje de cada venta. Haz la cuenta con tus números.',
    icon: WalletIcon,
  },
  {
    title: 'Más control del negocio',
    description:
      'Tu carta, tus precios, tus horarios y tus pedidos, desde un solo panel.',
    icon: SlidersHorizontalIcon,
  },
  {
    title: 'Tu propia tienda digital',
    description:
      'Con tus colores, tu tipografía, tu portada y un QR para cada mesa.',
    icon: PaletteIcon,
  },
  {
    title: 'Estadísticas en tiempo real',
    description:
      'Pedidos por hora y por día, ventas y clientes recurrentes en tu panel.',
    icon: BarChart3Icon,
  },
  {
    title: 'Mayor visibilidad local',
    description:
      'Apareces a los clientes que están cerca, ordenado por distancia.',
    icon: MapPinIcon,
  },
] as const

const BUSINESSES = [
  'Restaurantes',
  'Comidas rápidas',
  'Panaderías',
  'Repostería',
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
      className="bg-foreground text-background dark:bg-card dark:text-foreground relative isolate scroll-mt-24 overflow-hidden"
    >
      {/* A single warm glow in the corner: the brand, at night. */}
      <div
        aria-hidden="true"
        className="absolute -top-40 -right-40 -z-10 size-[36rem] rounded-full bg-[radial-gradient(closest-side,color-mix(in_oklch,var(--primary)_35%,transparent),transparent)] opacity-70"
      />

      <div className="container-page py-section grid gap-12 lg:grid-cols-[minmax(0,0.9fr)_minmax(0,1.1fr)] lg:gap-16">
        <FadeIn inView className="space-y-6 lg:sticky lg:top-28 lg:self-start">
          <p className="text-accent text-xs font-semibold tracking-wide uppercase">
            Para negocios
          </p>
          <h2
            id="merchant-title"
            className="text-h1 font-display font-semibold"
          >
            Gana más vendiendo con nosotros
          </h2>
          <p className="text-lead text-background/75 dark:text-muted-foreground text-pretty">
            Abre tu tienda digital en una tarde y empieza a recibir pedidos de
            clientes cerca de ti, con tu marca y sin perder el control.
          </p>

          <ul
            aria-label="Negocios que pueden vender"
            className="flex flex-wrap gap-2"
          >
            {BUSINESSES.map((business) => (
              <li
                key={business}
                className="rounded-pill bg-background/10 text-background/85 dark:bg-foreground/5 dark:text-foreground/85 px-3 py-1 text-xs font-medium ring-1 ring-current/10"
              >
                {business}
              </li>
            ))}
          </ul>

          <div className="flex flex-col gap-3 pt-2 sm:flex-row">
            <Button
              asChild
              size="lg"
              className="rounded-pill h-12 px-6 text-base active:scale-[0.98]"
            >
              <Link href="/register?role=merchant">
                Registrar mi negocio
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
        </FadeIn>

        <ul className="grid gap-3 sm:grid-cols-2">
          {MERCHANT_BENEFITS.map(
            ({ title, description, icon: Icon }, index) => (
              <li
                key={title}
                className={index === 0 ? 'sm:col-span-2' : undefined}
              >
                <FadeIn inView delay={index * 0.06} className="h-full">
                  <div className="rounded-card bg-background/[0.06] dark:bg-foreground/[0.04] hover:bg-background/[0.1] dark:hover:bg-foreground/[0.07] p-card h-full ring-1 ring-current/10 transition-colors duration-300">
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
                </FadeIn>
              </li>
            ),
          )}
        </ul>
      </div>
    </section>
  )
}
