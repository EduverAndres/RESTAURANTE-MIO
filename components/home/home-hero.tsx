import { BikeIcon, QrCodeIcon, ShoppingBagIcon, StoreIcon } from 'lucide-react'
import Link from 'next/link'
import { AddressPicker } from '@/components/home/address-picker'
import { SearchBox } from '@/components/home/search-box'
import { FadeIn } from '@/components/motion/fade-in'
import { APP_NAME } from '@/lib/env'
import type { VisitorLocation } from '@/lib/location'

/**
 * The top of the marketplace, addressed to two people at once.
 *
 * The diner still gets the search field first — someone who arrives knowing
 * what they want should not scroll past an advert for the product they are
 * already using. What changed is the room around it: a first-time visitor
 * now sees in one glance the three ways to order and that this is a place
 * where each restaurant looks like itself.
 *
 * The restaurant owner gets one quiet line pointing to their own section
 * below. They are not the majority of visits, but they are the ones who pay,
 * and they judge the product by imagining their customer standing here.
 */

const MODES = [
  { icon: BikeIcon, label: 'A domicilio' },
  { icon: ShoppingBagIcon, label: 'Para recoger' },
  { icon: QrCodeIcon, label: 'Desde la mesa' },
] as const

export function HomeHero({ location }: { location: VisitorLocation | null }) {
  return (
    <section className="border-border/60 relative isolate overflow-hidden border-b">
      {/* Warm wash in the brand colours. Painted with the platform tokens, so
          it follows the dark ramp and never competes with a store's theme. */}
      <div
        aria-hidden="true"
        className="bg-secondary/40 absolute inset-0 -z-10 bg-[radial-gradient(ellipse_80%_60%_at_15%_0%,color-mix(in_oklch,var(--primary)_16%,transparent),transparent_60%),radial-gradient(ellipse_70%_55%_at_90%_100%,color-mix(in_oklch,var(--accent)_18%,transparent),transparent_55%)]"
      />

      <div className="container-page py-12 lg:py-20">
        <FadeIn className="mx-auto max-w-3xl space-y-6 text-center">
          <p className="rounded-pill bg-primary/10 text-primary-on-tint inline-flex items-center gap-2 px-3 py-1 text-xs font-medium">
            <StoreIcon aria-hidden="true" className="size-3.5" />
            Cada restaurante con su propia tienda
          </p>

          <h1 className="text-display font-display font-display-soft font-semibold">
            Pide a tu restaurante{' '}
            <span className="text-primary">favorito</span>
            <br className="hidden sm:block" /> como si estuvieras ahí.
          </h1>

          <p className="text-muted-foreground text-lead mx-auto max-w-xl">
            En {APP_NAME} cada restaurante tiene su tienda, sus colores y su
            carta. Busca un plato o un sitio y pide en dos toques.
          </p>

          <div className="mx-auto flex max-w-2xl flex-col gap-3 pt-2">
            <SearchBox size="hero" />
            <AddressPicker
              initial={location}
              className="mx-auto justify-center"
            />
          </div>

          <ul
            aria-label="Formas de pedir"
            className="flex flex-wrap justify-center gap-2 pt-2"
          >
            {MODES.map(({ icon: Icon, label }) => (
              <li
                key={label}
                className="rounded-pill bg-card/80 border-border/60 text-foreground inline-flex items-center gap-2 border px-3 py-1.5 text-sm shadow-1"
              >
                <Icon aria-hidden="true" className="text-primary size-4" />
                {label}
              </li>
            ))}
          </ul>
        </FadeIn>

        <FadeIn inView className="mt-10 text-center">
          <Link
            href="#para-restaurantes"
            className="text-muted-foreground hover:text-foreground text-sm underline-offset-4 transition-colors hover:underline"
          >
            ¿Tenés un restaurante? Vendé con tu propia marca →
          </Link>
        </FadeIn>
      </div>
    </section>
  )
}
