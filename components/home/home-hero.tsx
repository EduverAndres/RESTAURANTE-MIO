import {
  ArrowRightIcon,
  BikeIcon,
  QrCodeIcon,
  ShoppingBagIcon,
  StoreIcon,
} from 'lucide-react'
import Link from 'next/link'
import { AddressPicker } from '@/components/home/address-picker'
import { HeroVisual } from '@/components/home/hero-visual'
import { SearchBox } from '@/components/home/search-box'
import { Button } from '@/components/ui/button'
import type { VisitorLocation } from '@/lib/location'

/**
 * The top of the marketplace, addressed to two people at once.
 *
 * The diner still gets the search field first — someone who arrives knowing
 * what they want should not scroll past an advert for the product they are
 * already using. Around it, a first-time visitor learns in one glance that
 * these are the neighbourhood's own businesses, the three ways to order, and
 * that a business can join from the same screen.
 *
 * The owner's way in is a real button, but the secondary one: they are not
 * the majority of visits, and the primary colour belongs to ordering.
 *
 * Deliberately still. The headline is the page's largest paint, so it is in
 * the server HTML at full opacity instead of waiting for a fade-in to hydrate,
 * and the background is the plain page colour: on a phone, the store cards
 * right below are the picture.
 */

const MODES = [
  { icon: BikeIcon, label: 'A domicilio' },
  { icon: ShoppingBagIcon, label: 'Para recoger' },
  { icon: QrCodeIcon, label: 'Desde la mesa' },
] as const

export function HomeHero({ location }: { location: VisitorLocation | null }) {
  return (
    <section className="border-border/60 border-b">
      <div className="container-page grid items-center gap-10 py-10 sm:py-14 lg:grid-cols-[minmax(0,1.15fr)_minmax(0,0.85fr)] lg:gap-14 lg:py-20">
        <div className="space-y-6 lg:space-y-7">
          <p className="text-primary-on-tint text-xs font-semibold tracking-wide uppercase">
            Hecho en Barranquilla
          </p>

          <h1 className="text-display font-display font-display-soft font-semibold">
            Pide a los negocios de{' '}
            <span className="text-primary">tu barrio</span>.
          </h1>

          <p className="text-muted-foreground text-lead max-w-xl">
            Restaurantes, panaderías y tiendas de Barranquilla. A domicilio,
            para recoger o desde la mesa, y lo sigues en vivo.
          </p>

          <div className="max-w-xl space-y-3">
            <div className="flex flex-wrap items-center gap-2 text-sm">
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
            {/* On a phone the owner's way in is the merchant band and the
                footer; the first screen stays the diner's. */}
            <Button
              asChild
              size="lg"
              variant="outline"
              className="rounded-pill hidden h-12 px-6 text-base active:scale-[0.98] sm:inline-flex"
            >
              <Link href="/register?role=merchant">
                <StoreIcon aria-hidden="true" data-icon="inline-start" />
                Registrar mi negocio
              </Link>
            </Button>
          </div>

          <ul
            aria-label="Formas de pedir"
            className="flex flex-wrap gap-2 pt-1"
          >
            {MODES.map(({ icon: Icon, label }) => (
              <li
                key={label}
                className="rounded-pill border-border text-foreground inline-flex items-center gap-2 border px-3 py-1.5 text-sm"
              >
                <Icon aria-hidden="true" className="text-primary size-4" />
                {label}
              </li>
            ))}
          </ul>
        </div>

        {/* The picture only earns its space beside the copy; on a phone the
            search box is the hero and the categories below do this job. */}
        <div className="hidden lg:block">
          <HeroVisual />
        </div>
      </div>
    </section>
  )
}
