'use client'

import Image from 'next/image'
import { cn } from '@/lib/utils'
import { Skeleton } from './skeleton'

interface OptimizedImageProps {
  src: string | null
  alt: string
  fill?: boolean
  priority?: boolean
  sizes?: string
  className?: string
  aspectRatio?: 'square' | 'video' | 'photo' | 'wide' | 'tall'
  blurDataURL?: string
  onLoad?: () => void
}

const ASPECT_RATIOS = {
  square: 'aspect-square',
  video: 'aspect-video',      /* 16:9 */
  photo: 'aspect-[4/3]',
  wide: 'aspect-[16/9]',
  tall: 'aspect-[3/4]',
} as const

export function OptimizedImage({
  src,
  alt,
  fill = false,
  priority = false,
  sizes,
  className,
  aspectRatio = 'photo',
  blurDataURL,
  onLoad,
}: OptimizedImageProps) {
  if (!src) {
    return (
      <div
        className={cn(
          'relative bg-muted overflow-hidden',
          ASPECT_RATIOS[aspectRatio],
          className
        )}
        aria-hidden="true"
      >
        <Skeleton className="absolute inset-0" />
      </div>
    )
  }

  return (
    <div className={cn('relative overflow-hidden', ASPECT_RATIOS[aspectRatio], className)}>
      <Image
        src={src}
        alt={alt}
        fill={fill}
        priority={priority}
        sizes={sizes}
        className={cn(
          'object-cover transition-opacity duration-normal ease-out',
          fill ? 'absolute inset-0' : 'w-full h-full'
        )}
        placeholder={blurDataURL ? 'blur' : 'empty'}
        blurDataURL={blurDataURL}
        loading={priority ? 'eager' : 'lazy'}
        onLoad={onLoad}
        quality={85}
      />
    </div>
  )
}

/* =============================================================================
 * PLACEHOLDER IMAGES — Para desarrollo y fallbacks
 * ========================================================================== */

export const placeholderImages = {
  dish: {
    pizza: '/placeholder-dish-pizza.webp',
    hamburger: '/placeholder-dish-hamburger.webp',
    steak: '/placeholder-dish-steak.webp',
    salad: '/placeholder-dish-salad.webp',
    coffee: '/placeholder-dish-coffee.webp',
    sushi: '/placeholder-dish-sushi.webp',
    dessert: '/placeholder-dish-dessert.webp',
    default: '/placeholder-dish-default.webp',
  },
  restaurant: {
    cover: '/placeholder-restaurant-cover.webp',
    logo: '/placeholder-restaurant-logo.webp',
  },
  category: {
    pizza: '/placeholder-cat-pizza.webp',
    hamburger: '/placeholder-cat-hamburger.webp',
    steak: '/placeholder-cat-steak.webp',
    salad: '/placeholder-cat-salad.webp',
    coffee: '/placeholder-cat-coffee.webp',
    fastFood: '/placeholder-cat-fastfood.webp',
    sushi: '/placeholder-cat-sushi.webp',
    dessert: '/placeholder-cat-dessert.webp',
    default: '/placeholder-cat-default.webp',
  },
} as const

export function getDishPlaceholder(category: string): string {
  const key = category.toLowerCase().replace(/\s+/g, '') as keyof typeof placeholderImages.dish
  return placeholderImages.dish[key] ?? placeholderImages.dish.default
}

export function getCategoryPlaceholder(category: string): string {
  const key = category.toLowerCase().replace(/\s+/g, '') as keyof typeof placeholderImages.category
  return placeholderImages.category[key] ?? placeholderImages.category.default
}