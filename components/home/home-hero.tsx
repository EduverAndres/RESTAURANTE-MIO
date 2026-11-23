import { ArrowRightIcon, BikeIcon, CalendarCheckIcon } from 'lucide-react'
import Link from 'next/link'
import { AddressPicker } from '@/components/home/address-picker'
import { SearchBox } from '@/components/home/search-box'
import { LiveOrderDemo } from '@/components/motion/live-order-demo'
import { Button } from '@/components/ui/button'
import type { VisitorLocation } from '@/lib/location'

/**
 * The top of the marketplace: what Cerquita is, in one sentence, and the two
 * things a customer comes to do — order and book a table.
 *
 * The promise is the product's own (docs/PRODUCTO.md): delivery, pickup or a
 * booked table; the menu price with nothing hidden on top; the order followed
 * live. No figure, no testimonial, nothing a visitor could not check.
 *
 * The search card keeps the field first — someone who arrives knowing what
 * they want should not scroll past an advert for the product they are already
 * using. Its header is the intent bar: ordering is what the card does,
 * booking is one tap away. Owners and couriers get their way in from the
 * header, the audience switcher and the footer; the first screen is the
 * customer's.
 *
 * Deliberately still where it counts. The headline is the page's largest
 * paint, so it is in the server HTML at full opacity with no entrance
 * animation. The only movement is the live-order demo beside it, from `lg`
 * up, in CSS, and only when motion is allowed.
 */
export function HomeHero({ location }: { location: VisitorLocation | null }) {
  return (
    <section className="border-border/60 brand-mesh relative overflow-hidden border-b">
      <div className="container-page relative grid items-center gap-10 py-10 sm:py-14 lg:grid-cols-[minmax(0,1.15fr)_minmax(0,0.85fr)] lg:gap-14 lg:py-20">
        <div className="space-y-6 lg:space-y-7">
          <p className="text-primary-on-tint text-xs font-semibold tracking-wide uppercase">
            Hecho en Barranquilla
          </p>

          <h1 className="text-display font-display font-display-soft font-semibold">
            Tus restaurantes favoritos,{' '}
            <span className="text-primary">a un toque</span>.
          </h1>

          <p className="text-muted-foreground text-lead max-w-xl">
            Pide a domicilio, recoge o reserva tu mesa. Pagas el precio de la
            carta, sin recargos ocultos, y sigues tu pedido en vivo.
          </p>

          <div className="rounded-card bg-card shadow-2 max-w-xl space-y-3 p-3 sm:p-4">
            <nav aria-label="¿Qué quieres hacer?">
              <ul className="bg-muted rounded-pill grid grid-cols-2 gap-1 p-1">
                <li>
                  <Link
                    href="#restaurantes"
                    aria-current="true"
                    className="rounded-pill bg-background text-foreground shadow-1 flex h-11 items-center justify-center gap-2 px-2 text-sm font-semibold sm:px-3"
                  >
                    <BikeIcon
                      aria-hidden="true"
                      className="text-primary size-4 max-[359px]:hidden"
                    />
                    Pedir domicilio
                  </Link>
                </li>
                <li>
                  <Link
                    href="/reservas"
                    className="rounded-pill text-foreground/75 hover:text-foreground hover:bg-background/60 flex h-11 items-center justify-center gap-2 px-2 text-sm font-medium transition-colors sm:px-3"
                  >
                    <CalendarCheckIcon
                      aria-hidden="true"
                      className="size-4 max-[359px]:hidden"
                    />
                    Reservar mesa
                  </Link>
                </li>
              </ul>
            </nav>
            <div className="flex flex-wrap items-center gap-2 px-1 text-sm">
              <span className="text-muted-foreground">Entregar en</span>
              <AddressPicker initial={location} />
            </div>
            <SearchBox size="hero" />
          </div>

          <div className="flex flex-col gap-3 sm:flex-row">
            <Button
              asChild
              size="lg"
              className="rounded-pill h-12 px-6 text-base active:scale-[0.98]"
            >
              <Link href="#restaurantes">
                Pedir ahora
                <ArrowRightIcon aria-hidden="true" data-icon="inline-end" />
              </Link>
            </Button>
            <Button
              asChild
              size="lg"
              variant="outline"
              className="rounded-pill h-12 px-6 text-base active:scale-[0.98]"
            >
              <Link href="/reservas">
                <CalendarCheckIcon
                  aria-hidden="true"
                  data-icon="inline-start"
                />
                Reservar mesa
              </Link>
            </Button>
          </div>
        </div>

        {/* The demo only earns its space beside the copy; on a phone the
            search card is the hero and the stores right below are the
            picture. */}
        <div className="hidden lg:block">
          <LiveOrderDemo />
        </div>
      </div>
    </section>
  )
}
