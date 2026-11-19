import {
  ArrowRightIcon,
  PaletteIcon,
  QrCodeIcon,
  WalletIcon,
} from 'lucide-react'
import Link from 'next/link'
import { SavingsCalculator } from '@/components/marketing/savings-calculator'
import { Button } from '@/components/ui/button'

/**
 * The part of the home addressed to the person who pays: the restaurant
 * owner. It sits after the diner content on purpose — an owner judges the
 * product by imagining their customer scrolling the sections above, and
 * arrives here already convinced or not. What this section adds is the
 * number, with their own figures in it.
 */

const PROMISES = [
  {
    icon: QrCodeIcon,
    title: 'El QR en la mesa',
    body: 'El cliente escanea, ve tu carta y pide sin llamar a nadie. Sin cuenta, sin descargar nada. Menos vueltas para el mesero y menos pedidos mal tomados.',
  },
  {
    icon: PaletteIcon,
    title: 'Tu marca, no la nuestra',
    body: 'Colores, tipografías, portada y hasta el orden de la carta. Tu tienda no parece una ficha más de un catálogo: se ve como tu negocio.',
  },
  {
    icon: WalletIcon,
    title: 'Cuentas claras',
    body: 'Lo que te pagan en efectivo es tuyo desde el primer momento. Lo que te pagan en línea te lo transferimos, y en tu panel ves cada venta, la comisión y cada transferencia.',
  },
] as const

export function ForRestaurants({
  standalone = false,
}: {
  /** As a page of its own the headline is the h1 and there is no rule above. */
  standalone?: boolean
}) {
  const Heading = standalone ? 'h1' : 'h2'
  return (
    <section
      id="para-restaurantes"
      aria-labelledby="para-restaurantes-title"
      className={
        standalone
          ? 'bg-card'
          : 'border-border/60 bg-card scroll-mt-24 border-t'
      }
    >
      <div className="container-page py-section">
        {/* No entrance animation: the headline is this page's largest paint
            and has to be in the HTML at full opacity. */}
        <div className="grid gap-10 lg:grid-cols-[minmax(0,1fr)_minmax(0,1.1fr)] lg:gap-14">
          <div className="space-y-8">
            <div className="space-y-3">
              <p className="text-primary text-xs font-semibold tracking-wide uppercase">
                Para negocios
              </p>
              <Heading
                id="para-restaurantes-title"
                className="text-h1 font-display font-semibold text-balance"
              >
                Tus clientes ya son tuyos. Tu canal de venta también debería
                serlo.
              </Heading>
              <p className="text-muted-foreground text-pretty">
                Recibe pedidos a domicilio, para recoger y desde la mesa con tu
                propia marca. Sin mensualidad: pagas solo cuando vendes.
              </p>
            </div>

            <ul className="space-y-5">
              {PROMISES.map(({ icon: Icon, title, body }) => (
                <li key={title} className="flex gap-4">
                  <span className="rounded-control bg-primary/10 text-primary-on-tint flex size-10 shrink-0 items-center justify-center">
                    <Icon aria-hidden="true" className="size-5" />
                  </span>
                  <div className="space-y-1">
                    <h3 className="font-display text-lg font-semibold">
                      {title}
                    </h3>
                    <p className="text-muted-foreground text-sm text-pretty">
                      {body}
                    </p>
                  </div>
                </li>
              ))}
            </ul>

            <div className="flex flex-wrap gap-3">
              <Button asChild size="lg">
                <Link href="/register">
                  Crear mi tienda
                  <ArrowRightIcon aria-hidden="true" data-icon="inline-end" />
                </Link>
              </Button>
              <Button asChild size="lg" variant="outline">
                <Link href="/t/sushi-nocturno">Ver una tienda de verdad</Link>
              </Button>
            </div>
          </div>

          <div className="space-y-4 lg:pt-10">
            <div className="space-y-1">
              <h3 className="text-h3 font-display font-semibold">
                Haz la cuenta con tus números
              </h3>
              <p className="text-muted-foreground text-sm">
                No vamos a adivinar cuánto te cobran. Ponlo tú, que lo sabes
                mejor que nadie.
              </p>
            </div>
            <SavingsCalculator />
          </div>
        </div>
      </div>
    </section>
  )
}
