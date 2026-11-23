import {
  BadgeCheckIcon,
  KeyRoundIcon,
  MessageCircleIcon,
  RadarIcon,
  ShieldCheckIcon,
} from 'lucide-react'
import { supportWhatsAppUrl } from '@/lib/marketplace/support'

/**
 * What a first-time visitor needs to believe before handing over an address
 * and a card. Every line here is something the product already does — a store
 * is reviewed before it goes live, payments go through a certified gateway,
 * the order is tracked state by state and only the customer's code closes a
 * delivery — so the strip can be blunt about it.
 *
 * Two columns on a phone, one row from `md`. It used to be a rail on phones,
 * but a scroll region with nothing focusable in it cannot be scrolled from a
 * keyboard (axe: scrollable-region-focusable), and four short promises fit
 * on screen anyway.
 */
const PROMISES = [
  {
    icon: BadgeCheckIcon,
    title: 'Comercios verificados',
    text: 'Revisamos cada negocio antes de publicarlo.',
  },
  {
    icon: ShieldCheckIcon,
    title: 'Pagos protegidos',
    text: 'Cobros con pasarelas de pago certificadas.',
  },
  {
    icon: RadarIcon,
    title: 'Seguimiento en vivo',
    text: 'Ves tu pedido avanzar estado por estado.',
  },
  {
    icon: KeyRoundIcon,
    title: 'Entrega con código',
    text: 'Solo tu código confirma que lo recibiste.',
  },
] as const

export function TrustBar() {
  const support = supportWhatsAppUrl('Hola, necesito ayuda con un pedido.')

  return (
    <section
      aria-label="Por qué confiar"
      className="border-border/60 bg-card border-b"
    >
      <div className="container-page py-5">
        <ul className="grid grid-cols-2 gap-x-4 gap-y-5 md:grid-cols-4 md:gap-3">
          {PROMISES.map(({ icon: Icon, title, text }) => (
            <li
              key={title}
              className="flex flex-col items-start gap-2 sm:flex-row sm:gap-3"
            >
              <span className="rounded-control bg-primary/10 text-primary-on-tint grid size-10 shrink-0 place-items-center">
                <Icon aria-hidden="true" className="size-5" />
              </span>
              <span className="min-w-0">
                <span className="block text-sm font-semibold">{title}</span>
                <span className="text-muted-foreground block text-xs text-pretty">
                  {text}
                </span>
              </span>
            </li>
          ))}
        </ul>

        {support ? (
          <p className="text-muted-foreground mt-4 flex flex-wrap items-center gap-x-2 text-sm">
            <MessageCircleIcon
              aria-hidden="true"
              className="text-success size-4"
            />
            ¿Algo salió mal?
            <a
              href={support}
              target="_blank"
              rel="noopener noreferrer"
              className="text-foreground font-medium underline-offset-4 hover:underline"
            >
              Escríbenos por WhatsApp
            </a>
          </p>
        ) : null}
      </div>
    </section>
  )
}
