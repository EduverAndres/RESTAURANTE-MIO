import {
  ArrowRightIcon,
  BikeIcon,
  MapPinIcon,
  QrCodeIcon,
  ShoppingBagIcon,
  StoreIcon,
} from 'lucide-react'
import Link from 'next/link'
import { AddressPicker } from '@/components/home/address-picker'
import { HeroVisual } from '@/components/home/hero-visual'
import { SearchBox } from '@/components/home/search-box'
import { FadeIn } from '@/components/motion/fade-in'
import { Button } from '@/components/ui/button'
import type { VisitorLocation } from '@/lib/location'

/**
 * The top of the marketplace, addressed to two people at once.
 *
 * The diner still gets the search field first — someone who arrives knowing
 * what they want should not scroll past an advert for the product they are
 * already using. Around it, a first-time visitor learns in one glance that
 * this is the city's local marketplace, the three ways to order, and that a
 * business can join from the same screen.
 *
 * The owner's way in is a real button now, but the secondary one: they are
 * not the majority of visits, and the primary colour belongs to ordering.
 */

const MODES = [
  { icon: BikeIcon, label: 'A domicilio' },
  { icon: ShoppingBagIcon, label: 'Para recoger' },
  { icon: QrCodeIcon, label: 'Desde la mesa' },
] as const

export function HomeHero({ location }: { location: VisitorLocation | null }) {
  return (
    <section className="border-border/60 relative isolate overflow-hidden border-b">
      {/* Warm wash in the brand colours plus a hairline grid. Painted with the
          platform tokens, so it follows the dark ramp and never competes with
          a store's theme. */}
      <div aria-hidden="true" className="brand-mesh absolute inset-0 -z-20" />
      <div aria-hidden="true" className="brand-grid absolute inset-0 -z-10" />

      <div className="container-page grid items-center gap-10 py-10 sm:py-14 lg:grid-cols-[minmax(0,1.15fr)_minmax(0,0.85fr)] lg:gap-14 lg:py-20">
        <FadeIn className="space-y-6 lg:space-y-7">
          <p className="rounded-pill bg-card/80 text-foreground shadow-1 ring-foreground/5 inline-flex items-center gap-2 py-1 pr-3 pl-1 text-xs font-medium ring-1 backdrop-blur-sm">
            <span className="rounded-pill bg-primary text-primary-foreground inline-flex items-center gap-1 px-2 py-0.5">
              <MapPinIcon aria-hidden="true" className="size-3" />
              Barranquilla
            </span>
            El marketplace del comercio local
          </p>

          <h1 className="text-display font-display font-display-soft font-semibold">
            Todo <span className="text-primary">Barranquilla</span> en una sola
            plataforma.
          </h1>

          <p className="text-muted-foreground text-lead max-w-xl">
            Pide a los restaurantes y negocios de tu barrio en dos toques, sigue
            tu pedido en vivo y apoya a la gente de aquí.
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
              className="rounded-pill shadow-2 hover:shadow-3 h-12 px-6 text-base transition-[box-shadow,transform] active:scale-[0.98]"
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
              className="rounded-pill bg-card/70 h-12 px-6 text-base backdrop-blur-sm active:scale-[0.98]"
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
                className="rounded-pill bg-card/80 border-border/60 text-foreground inline-flex items-center gap-2 border px-3 py-1.5 text-sm backdrop-blur-sm"
              >
                <Icon aria-hidden="true" className="text-primary size-4" />
                {label}
              </li>
            ))}
          </ul>
        </FadeIn>

        {/* The picture only earns its space beside the copy; on a phone the
            search box is the hero and the categories below do this job. */}
        <FadeIn delay={0.15} className="hidden lg:block">
          <HeroVisual />
        </FadeIn>
      </div>
    </section>
  )
}
