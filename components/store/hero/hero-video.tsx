import {
  HeroCta,
  HeroLogo,
  HeroName,
  HeroTagline,
} from '@/components/store/hero/hero-parts'
import { VideoBackdrop } from '@/components/store/hero/video-backdrop'
import { StatusChips } from '@/components/store/status-chips'
import { StoreImage } from '@/components/store/store-image'
import type { StoreSectionProps } from '@/components/store/storefront-context'
import { cn } from '@/lib/utils'
import { HeroFull } from '@/components/store/hero/hero-full'

/**
 * A looping video behind the name, with a gradient so the type stays legible
 * and a pause control the visitor can actually reach. Without a video URL
 * there is nothing to show, so it degrades to the full-bleed hero rather than
 * rendering an empty black band.
 */
export function HeroVideo({ context }: StoreSectionProps) {
  const { store, theme } = context
  const video = theme.hero.videoUrl
  if (!video) return <HeroFull context={context} />

  const poster = theme.banner.imageUrl ?? store.cover_url
  const overlay = theme.banner.overlayOpacity
  const centered = theme.hero.align === 'center'

  return (
    <header className="relative isolate flex min-h-[70vh] w-full flex-col justify-end overflow-hidden bg-black">
      {poster ? (
        <div aria-hidden="true" className="absolute inset-0">
          <StoreImage
            src={poster}
            alt=""
            seed={store.slug}
            color={theme.primary}
            label={store.name}
            sizes="100vw"
            priority
            initialScale={2.6}
          />
        </div>
      ) : null}

      <VideoBackdrop
        src={video}
        poster={poster}
        motionOff={theme.motion === 'none'}
      />

      <div
        aria-hidden="true"
        className="absolute inset-0"
        style={{
          background: `linear-gradient(to top, rgb(0 0 0 / ${Math.min(overlay + 0.55, 0.96)}) 0%, rgb(0 0 0 / ${overlay}) 55%, transparent 100%)`,
        }}
      />

      <div
        className={cn(
          'container-page pb-section relative flex flex-col gap-5',
          centered && 'items-center text-center',
        )}
      >
        <HeroLogo context={context} shape="circle" />
        <HeroName
          name={store.name}
          className="text-display max-w-[14ch] text-white"
        />
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
