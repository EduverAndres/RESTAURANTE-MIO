import {
  BadgeCheckIcon,
  CreditCardIcon,
  MessageCircleIcon,
  RadarIcon,
  ReceiptTextIcon,
  ZapIcon,
} from 'lucide-react'
import { FadeIn } from '@/components/motion/fade-in'

/**
 * Why order here instead of calling the restaurant. Six promises, each one
 * something the product already keeps: the ETA is computed from the real
 * distance, a store goes live only after review, the order is tracked state
 * by state, the menu price is the price, the merchant's WhatsApp is on its
 * page and payments go through certified gateways.
 *
 * Rendered on the server: the copy is the point of the section, so it has to
 * be in the HTML for search engines and for anyone on a slow connection.
 */
const BENEFITS = [
  {
    title: 'Entrega rápida',
    description:
      'Ves el tiempo estimado antes de pedir, calculado con la distancia real hasta tu puerta.',
    icon: ZapIcon,
  },
  {
    title: 'Comercios verificados',
    description:
      'Cada negocio pasa por una revisión antes de aparecer en la plataforma.',
    icon: BadgeCheckIcon,
  },
  {
    title: 'Seguimiento en tiempo real',
    description:
      'Sigue tu pedido estado por estado, desde la cocina hasta tu puerta.',
    icon: RadarIcon,
  },
  {
    title: 'Precios claros',
    description:
      'El precio de la carta es el precio: pagas eso, el envío y la propina que elijas.',
    icon: ReceiptTextIcon,
  },
  {
    title: 'Atención local',
    description:
      'Negocios de Barranquilla con los que puedes hablar directo cuando lo necesites.',
    icon: MessageCircleIcon,
  },
  {
    title: 'Pagos seguros',
    description:
      'Cobros con pasarelas certificadas y entrega confirmada con tu código.',
    icon: CreditCardIcon,
  },
] as const

export function BenefitsSection() {
  return (
    <section
      aria-labelledby="beneficios-title"
      className="border-border/60 bg-secondary/40 border-t"
    >
      <div className="container-page py-section">
        <FadeIn inView className="mb-10 max-w-2xl space-y-3">
          <p className="text-primary-on-tint text-xs font-semibold tracking-wide uppercase">
            Para ti
          </p>
          <h2
            id="beneficios-title"
            className="text-h1 font-display font-semibold"
          >
            Pedir aquí es más fácil, y se nota.
          </h2>
          <p className="text-muted-foreground text-lead">
            Lo bueno de pedirle al negocio de la esquina, con la tranquilidad de
            una app hecha para eso.
          </p>
        </FadeIn>

        <ul className="gap-card grid sm:grid-cols-2 lg:grid-cols-3">
          {BENEFITS.map(({ title, description, icon: Icon }, index) => (
            <li key={title}>
              <FadeIn inView delay={(index % 3) * 0.08} className="h-full">
                <div className="group rounded-card bg-card shadow-1 hover:shadow-2 ring-foreground/5 p-card h-full ring-1 transition-[box-shadow,transform] duration-300 hover:-translate-y-1">
                  <span className="rounded-control from-primary/15 to-accent/15 text-primary-on-tint mb-4 grid size-12 place-items-center bg-gradient-to-br transition-transform duration-300 group-hover:scale-105">
                    <Icon aria-hidden="true" className="size-6" />
                  </span>
                  <h3 className="font-display mb-1.5 text-xl font-semibold">
                    {title}
                  </h3>
                  <p className="text-muted-foreground text-sm text-pretty">
                    {description}
                  </p>
                </div>
              </FadeIn>
            </li>
          ))}
        </ul>
      </div>
    </section>
  )
}
