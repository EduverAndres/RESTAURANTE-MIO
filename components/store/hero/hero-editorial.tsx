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
 * Magazine cover: the name set enormous over the theme pattern, a small
 * photograph floating off the baseline, and a great deal of air. Built for a
 * brand with a strong name and no need to shout about its food.
 */
export function HeroEditorial({ context }: StoreSectionProps) {
  const { store, theme } = context
  const image = theme.banner.imageUrl ?? store.cover_url
  const centered = theme.hero.align === 'center'

  return (
    <header className="relative isolate overflow-hidden bg-[var(--store-background)]">
      <HeroPattern />
      <div
        aria-hidden="true"
        className="absolute inset-x-0 top-0 h-1/2 bg-[image:var(--store-gradient)] opacity-40"
      />

      <div
        className={cn(
          'container-page py-section relative flex flex-col gap-8',
          centered && 'items-center text-center',
        )}
      >
        <div
          className={cn(
            'flex flex-wrap items-center gap-3',
            centered && 'justify-center',
          )}
        >
          <HeroLogo context={context} shape="circle" />
          {store.category ? (
            <span className="text-sm font-medium tracking-[0.2em] text-[rgb(var(--store-text-rgb)/0.6)] uppercase">
              {store.category}
            </span>
          ) : null}
        </div>

        <div className="relative">
          <HeroName
            name={store.name}
            // Deliberately larger than --text-display: this hero is the name.
            className="max-w-[12ch] text-[clamp(2.75rem,1.0rem+8vw,8rem)] leading-[0.92] text-[var(--store-text)]"
          />
          {image ? (
            <div
              className={cn(
                'store-media shadow-3 mt-6 aspect-square w-40 sm:absolute sm:-top-6 sm:right-0 sm:mt-0 sm:w-48 lg:w-64',
                centered && 'mx-auto sm:mx-0',
              )}
            >
              <StoreImage
                src={image}
                alt=""
                seed={store.slug}
                color={theme.primary}
                label={store.name}
                sizes="256px"
                priority
                initialScale={2}
              />
            </div>
          ) : null}
        </div>

        <HeroTagline
          context={context}
          className="text-lead max-w-prose text-[rgb(var(--store-text-rgb)/0.7)]"
        />
        <StatusChips
          context={context}
          className={cn(centered && 'justify-center')}
        />
        <div className={cn('flex', centered && 'justify-center')}>
          <HeroCta context={context} />
        </div>
      </div>
    </header>
  )
}
