import { MessageCircleIcon, ReceiptTextIcon, ZapIcon } from 'lucide-react'

/**
 * Why order here instead of calling the restaurant. Three promises, each one
 * something the product already keeps: the ETA is computed from the real
 * distance, the menu price is the price, and the merchant's WhatsApp is on
 * its page.
 *
 * Verified stores, live tracking, protected payments and the delivery code
 * are not repeated here: the trust bar under the hero already says them, and
 * saying them twice made the page longer without making it more convincing.
 *
 * Rendered on the server and painted at rest: the copy is the point of the
 * section, so it has to be in the HTML, visible, for search engines and for
 * anyone on a slow connection.
 */
const BENEFITS = [
  {
    title: 'Entrega rápida',
    description:
      'Ves el tiempo estimado antes de pedir, calculado con la distancia real hasta tu puerta.',
    icon: ZapIcon,
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
] as const

export function BenefitsSection() {
  return (
    <section
      aria-labelledby="beneficios-title"
      className="border-border/60 bg-secondary/40 border-t"
    >
      <div className="container-page py-section">
        <div className="mb-10 max-w-2xl space-y-3">
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
        </div>

        <ul className="gap-card grid sm:grid-cols-3">
          {BENEFITS.map(({ title, description, icon: Icon }) => (
            <li
              key={title}
              className="rounded-card bg-card shadow-1 p-card h-full"
            >
              <span className="rounded-control bg-primary/10 text-primary-on-tint mb-4 grid size-12 place-items-center">
                <Icon aria-hidden="true" className="size-6" />
              </span>
              <h3 className="font-display mb-1.5 text-xl font-semibold">
                {title}
              </h3>
              <p className="text-muted-foreground text-sm text-pretty">
                {description}
              </p>
            </li>
          ))}
        </ul>
      </div>
    </section>
  )
}
