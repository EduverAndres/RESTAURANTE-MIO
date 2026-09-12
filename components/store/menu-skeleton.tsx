import { masonryRatio, menuLayoutStrategy } from '@/lib/store/menu-layout'
import { cn } from '@/lib/utils'
import type { StoreTheme } from '@/types/app'

interface MenuSkeletonProps {
  theme: StoreTheme
  /** How many placeholder cards to draw. */
  count?: number
}

function Block({ className }: { className?: string }) {
  return (
    <div
      className={cn(
        'animate-pulse rounded-[var(--store-radius)] bg-[rgb(var(--store-text-rgb)/0.07)]',
        className,
      )}
    />
  )
}

/**
 * The loading state has to be the same shape as the thing it is replacing, or
 * the page jumps when the data lands. So it reads the same layout strategy and
 * the same `--store-image-ratio` as the real menu, including masonry's seeded
 * heights.
 */
export function MenuSkeleton({ theme, count = 6 }: MenuSkeletonProps) {
  const strategy = menuLayoutStrategy(theme.menuLayout)
  const row = strategy.orientation === 'row'

  return (
    <div aria-hidden="true" className="space-y-8">
      <div className="flex gap-2 py-3">
        {Array.from({ length: 4 }, (_, index) => (
          <Block key={index} className="rounded-pill h-8 w-24" />
        ))}
      </div>
      <Block className="h-9 w-48" />

      <div className={strategy.container}>
        {Array.from({ length: count }, (_, index) => (
          <div
            key={index}
            className={cn(
              strategy.item(index),
              'store-card [border:var(--store-card-border)]',
              row ? 'flex gap-3 p-3' : 'flex flex-col',
            )}
          >
            <div
              className={cn(
                'animate-pulse bg-[rgb(var(--store-text-rgb)/0.07)]',
                row
                  ? 'order-2 size-24 shrink-0 rounded-[var(--store-image-radius)] sm:size-28'
                  : 'w-full rounded-t-[var(--store-radius)]',
              )}
              style={
                row
                  ? undefined
                  : {
                      aspectRatio: strategy.fixedRatio
                        ? 'var(--store-image-ratio)'
                        : masonryRatio(`skeleton-${index}`),
                    }
              }
            />
            <div
              className={cn(
                'flex flex-1 flex-col gap-2',
                row ? 'order-1 py-1' : 'p-[var(--store-density-padding)]',
              )}
            >
              <Block className="h-5 w-2/3 rounded-md" />
              <Block className="h-4 w-full rounded-md" />
              <Block className="h-4 w-1/2 rounded-md" />
              <div className="mt-auto flex items-center justify-between pt-2">
                <Block className="h-5 w-20 rounded-md" />
                <Block className="size-10 rounded-[var(--store-button-radius)]" />
              </div>
            </div>
          </div>
        ))}
      </div>
    </div>
  )
}
