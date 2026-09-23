import { ArrowRightIcon, PaletteIcon, QrCodeIcon, WalletIcon } from 'lucide-react'
import Link from 'next/link'
import { SavingsCalculator } from '@/components/marketing/savings-calculator'
import { FadeIn } from '@/components/motion/fade-in'
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
    body: 'El comensal escanea, ve tu carta y pide sin llamar a nadie. Sin cuenta, sin descargar nada. Menos vueltas para el mozo y menos pedidos mal tomados.',
  },
  {
    icon: PaletteIcon,
    title: 'Tu marca, no la nuestra',
    body: 'Colores, tipografías, portada y hasta el orden de la carta. Tu tienda no parece una ficha dentro de un catálogo: parece tu local.',
  },
  {
    icon: WalletIcon,
    title: 'La plata va directo a vos',
    body: 'Cobrás con tus propias credenciales de pago. Nosotros no tocamos la plata de tus ventas en ningún momento.',
  },
] as const

export function ForRestaurants() {
  return (
    <section
      id="para-restaurantes"
      aria-labelledby="para-restaurantes-title"
      className="border-border/60 bg-card scroll-mt-24 border-t"
    >
      <div className="container-page py-section">
        <FadeIn inView className="grid gap-10 lg:grid-cols-[minmax(0,1fr)_minmax(0,1.1fr)] lg:gap-14">
          <div className="space-y-8">
            <div className="space-y-3">
              <p className="text-primary text-xs font-semibold tracking-wide uppercase">
                Para restaurantes
              </p>
              <h2
                id="para-restaurantes-title"
                className="text-h1 font-display font-semibold text-balance"
              >
                Tus clientes ya son tuyos. Tu canal de venta también debería
                serlo.
              </h2>
              <p className="text-muted-foreground text-pretty">
                Recibí pedidos a domicilio, para recoger y desde la mesa con tu
                propia marca. Una mensualidad fija, no un porcentaje de cada
                venta.
              </p>
            </div>

            <ul className="space-y-5">
              {PROMISES.map(({ icon: Icon, title, body }) => (
                <li key={title} className="flex gap-4">
                  <span className="rounded-control bg-primary/10 text-primary-on-tint flex size-10 shrink-0 items-center justify-center">
                    <Icon aria-hidden="true" className="size-5" />
                  </span>
                  <div className="space-y-1">
                    <h3 className="font-display text-lg font-semibold">{title}</h3>
                    <p className="text-muted-foreground text-sm text-pretty">{body}</p>
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
                Hacé la cuenta con tus números
              </h3>
              <p className="text-muted-foreground text-sm">
                No te vamos a decir cuánto te cobran. Ponelo vos, que lo sabés
                mejor que nadie.
              </p>
            </div>
            <SavingsCalculator />
          </div>
        </FadeIn>
      </div>
    </section>
  )
}
