import { StoreIcon } from 'lucide-react'
import { AddressPicker } from '@/components/home/address-picker'
import { SearchBox } from '@/components/home/search-box'
import { FadeIn } from '@/components/motion/fade-in'
import { APP_NAME } from '@/lib/env'
import type { VisitorLocation } from '@/lib/location'

/**
 * The top of the marketplace. One brand line, then the search field — which
 * is what almost every visit is actually for. The old layout put a headline,
 * a paragraph, two buttons and an illustration above the search box; people
 * who arrive knowing what they want should not have to scroll past an advert
 * for the product they are already using.
 */
export function HomeHero({ location }: { location: VisitorLocation | null }) {
  return (
    <section className="border-border/60 bg-secondary/40 border-b">
      <div className="container-page py-10 lg:py-14">
        <FadeIn className="mx-auto max-w-3xl space-y-6 text-center">
          <p className="rounded-pill bg-primary/10 text-primary-on-tint inline-flex items-center gap-2 px-3 py-1 text-xs font-medium">
            <StoreIcon aria-hidden="true" className="size-3.5" />
            Restaurantes con identidad propia
          </p>
          <h1 className="text-display font-display font-display-soft font-semibold">
            Pide a tu restaurante <span className="text-primary">favorito</span>
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
        </FadeIn>
      </div>
    </section>
  )
}
