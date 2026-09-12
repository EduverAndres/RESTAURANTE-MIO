import Image from 'next/image'
import { PlaceholderImage } from '@/components/store/placeholder-image'
import { cn } from '@/lib/utils'

interface StoreImageProps {
  src: string | null
  /** Empty string marks the image as decorative. */
  alt: string
  seed: string
  color: string
  label: string
  sizes: string
  priority?: boolean
  className?: string
  initialScale?: number
}

/**
 * One photo slot for the whole storefront: a real image when there is one, the
 * deterministic pattern when there is not. Always fills its parent, which must
 * be positioned and must own the aspect ratio.
 */
export function StoreImage({
  src,
  alt,
  seed,
  color,
  label,
  sizes,
  priority = false,
  className,
  initialScale,
}: StoreImageProps) {
  if (!src) {
    return (
      <PlaceholderImage
        seed={seed}
        color={color}
        label={label}
        className={cn('absolute inset-0', className)}
        initialScale={initialScale}
      />
    )
  }

  return (
    <Image
      src={src}
      alt={alt}
      fill
      sizes={sizes}
      priority={priority}
      className={cn('object-cover', className)}
    />
  )
}
