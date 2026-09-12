import { ArrowRightIcon } from 'lucide-react'
import { StoreImage } from '@/components/store/store-image'
import type { StorefrontContext } from '@/components/store/storefront-context'
import { cn } from '@/lib/utils'
import type { ThemeLogoSize } from '@/types/app'

/** Where the menu section anchors, so every hero CTA can point at it. */
export const MENU_ANCHOR = 'menu'

const LOGO_SIZE: Record<ThemeLogoSize, string> = {
  sm: 'size-14 sm:size-16',
  md: 'size-20 sm:size-24',
  lg: 'size-28 sm:size-32',
}

interface HeroLogoProps {
  context: StorefrontContext
  /** Circular for the compact bar, themed shape everywhere else. */
  shape?: 'theme' | 'circle'
  className?: string
}

export function HeroLogo({
  context,
  shape = 'theme',
  className,
}: HeroLogoProps) {
  const { store, theme } = context
  if (!theme.hero.showLogo) return null
  const src = theme.logoUrl ?? store.logo_url

  return (
    <div
      className={cn(
        'shadow-2 relative shrink-0 overflow-hidden bg-[var(--store-surface)] ring-2 ring-[rgb(var(--store-background-rgb)/0.9)]',
        LOGO_SIZE[theme.hero.logoSize],
        shape === 'circle' ? 'rounded-full' : 'rounded-[var(--store-radius)]',
        className,
      )}
    >
      <StoreImage
        src={src}
        alt=""
        seed={`logo-${store.slug}`}
        color={theme.primary}
        label={store.name}
        sizes="128px"
        initialScale={1.15}
      />
    </div>
  )
}

interface HeroNameProps {
  name: string
  className?: string
  /** The hero owns the page's single h1. */
  as?: 'h1' | 'p'
}

export function HeroName({ name, className, as = 'h1' }: HeroNameProps) {
  const Tag = as
  return <Tag className={cn('store-heading', className)}>{name}</Tag>
}

export function HeroTagline({
  context,
  className,
}: {
  context: StorefrontContext
  className?: string
}) {
  const text = context.theme.hero.tagline ?? context.store.description
  if (!text) return null
  return <p className={cn('text-pretty', className)}>{text}</p>
}

export function HeroCta({
  context,
  className,
}: {
  context: StorefrontContext
  className?: string
}) {
  const label = context.theme.hero.ctaLabel ?? 'Ver el menú'
  return (
    <a
      href={`#${MENU_ANCHOR}`}
      className={cn(
        'store-btn h-11 px-5 text-[var(--text-small)]',
        'transition-transform hover:-translate-y-0.5',
        className,
      )}
    >
      {label}
      <ArrowRightIcon aria-hidden="true" className="size-4" />
    </a>
  )
}

/** The tenant pattern, as a decorative wash behind a hero. */
export function HeroPattern({ className }: { className?: string }) {
  return (
    <div
      aria-hidden="true"
      className={cn('store-pattern absolute inset-0', className)}
    />
  )
}

/** The optional brand gradient, painted under the content. */
export function HeroGradient({ className }: { className?: string }) {
  return (
    <div
      aria-hidden="true"
      className={cn(
        'absolute inset-0 bg-[image:var(--store-gradient)]',
        className,
      )}
    />
  )
}
