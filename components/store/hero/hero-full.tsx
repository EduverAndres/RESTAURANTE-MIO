import {
  HeroCta,
  HeroLogo,
  HeroName,
  HeroTagline,
} from '@/components/store/hero/hero-parts'
import { StatusChips } from '@/components/store/status-chips'
import { StoreImage } from '@/components/store/store-image'
import type { StoreSectionProps } from '@/components/store/storefront-context'
import { cn } from '@/lib/utils'

/**
 * Edge to edge photograph, everything else laid over it: logo and name at the
 * bottom left, the tagline in display type, the facts as chips. The default,
 * and the one that rewards a merchant with a good photo.
 */
export function HeroFull({ context }: StoreSectionProps) {
  const { store, theme } = context
  const image = theme.banner.imageUrl ?? store.cover_url
  const overlay = theme.banner.overlayOpacity
  const centered = theme.hero.align === 'center'

  return (
    <header className="relative isolate flex min-h-[68vh] w-full flex-col justify-end overflow-hidden sm:min-h-[72vh]">
      <div className="absolute inset-0 -z-10">
        <StoreImage
          src={image}
          alt=""
          seed={store.slug}
          color={theme.primary}
          label={store.name}
          sizes="100vw"
          priority
          initialScale={2.6}
        />
      </div>
      <div
        aria-hidden="true"
        className="absolute inset-0 -z-10"
        style={{
          background: `linear-gradient(to top, rgb(0 0 0 / ${Math.min(overlay + 0.5, 0.96)}) 0%, rgb(0 0 0 / ${overlay}) 45%, rgb(0 0 0 / ${Math.max(overlay - 0.2, 0)}) 100%)`,
        }}
      />

      <div
        className={cn(
          'container-page pb-section flex flex-col gap-5',
          centered && 'items-center text-center',
        )}
      >
        <div
          className={cn(
            'flex items-end gap-4',
            centered && 'flex-col items-center',
          )}
        >
          <HeroLogo context={context} />
          <div className={cn('min-w-0 space-y-1', centered && 'text-center')}>
            {store.category ? (
              <p className="text-sm font-medium tracking-wide text-white/80 uppercase">
                {store.category}
              </p>
            ) : null}
            <HeroName
              name={store.name}
              className="text-display max-w-[16ch] text-white drop-shadow-sm"
            />
          </div>
        </div>

        <HeroTagline
          context={context}
          className="text-lead max-w-2xl text-white/85"
        />
        <StatusChips
          context={context}
          tone="image"
          className={cn(centered && 'justify-center')}
        />
        <div className={cn('flex', centered && 'justify-center')}>
          <HeroCta context={context} />
        </div>
      </div>
    </header>
  )
}
