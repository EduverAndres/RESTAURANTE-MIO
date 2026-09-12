import {
  HeroCta,
  HeroLogo,
  HeroName,
  HeroPattern,
  HeroTagline,
} from '@/components/store/hero/hero-parts'
import { StatusChips } from '@/components/store/status-chips'
import { StoreImage } from '@/components/store/store-image'
import type { StoreSectionProps } from '@/components/store/storefront-context'
import { cn } from '@/lib/utils'

/**
 * Half text on the theme background, half photograph cut to the theme's image
 * shape. On a phone the text comes first and the picture sits underneath, so
 * the name is readable before anything has to load.
 */
export function HeroSplit({ context }: StoreSectionProps) {
  const { store, theme } = context
  const image = theme.banner.imageUrl ?? store.cover_url
  const centered = theme.hero.align === 'center'

  return (
    <header className="relative isolate overflow-hidden bg-[var(--store-background)]">
      <HeroPattern />
      <div className="container-page gap-inline py-section relative grid items-center lg:grid-cols-2">
        <div
          className={cn(
            'order-2 flex flex-col gap-5 lg:order-1',
            centered && 'items-center text-center',
          )}
        >
          <HeroLogo context={context} />
          {store.category ? (
            <p className="store-chip w-fit">{store.category}</p>
          ) : null}
          <HeroName
            name={store.name}
            className="text-h1 text-[var(--store-text)]"
          />
          <HeroTagline
            context={context}
            className="text-lead max-w-prose text-[rgb(var(--store-text-rgb)/0.72)]"
          />
          <StatusChips
            context={context}
            className={cn(centered && 'justify-center')}
          />
          <div className={cn('flex', centered && 'justify-center')}>
            <HeroCta context={context} />
          </div>
        </div>

        <div className="order-1 lg:order-2">
          <div className="store-media shadow-3 relative aspect-[4/3] w-full lg:aspect-[5/6]">
            <StoreImage
              src={image}
              alt=""
              seed={store.slug}
              color={theme.primary}
              label={store.name}
              sizes="(min-width: 1024px) 50vw, 100vw"
              priority
              initialScale={2.2}
            />
          </div>
        </div>
      </div>
    </header>
  )
}
