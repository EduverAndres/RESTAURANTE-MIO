import { StoreCard, type StoreCardData } from '@/components/store/store-card'
import { cn } from '@/lib/utils'

interface StoreRailProps {
  stores: StoreCardData[]
  /** Labels the scroll region for a screen reader. */
  label: string
  /** Only ever pass `true` for the first list on the page. */
  priority?: boolean
  className?: string
}

/**
 * A horizontal carousel on a phone, a plain grid from `lg` up.
 *
 * A single column of tall cards is the worst of both worlds on a phone: you
 * scroll past three restaurants to learn there was a fourth, and you never
 * see two options side by side. A rail shows the next card's edge, which is
 * the whole invitation. On a wide screen there is room for the grid, so the
 * same markup stops scrolling and lays itself out.
 *
 * The rail is a list of links, so it is reachable and scrollable by keyboard
 * without a tabindex of its own.
 */
export function StoreRail({
  stores,
  label,
  priority = false,
  className,
}: StoreRailProps) {
  return (
    <ul
      aria-label={label}
      className={cn(
        'rail -mx-gutter px-gutter gap-card pt-1 pb-3',
        'lg:mx-0 lg:grid lg:grid-cols-3 lg:overflow-visible lg:px-0 lg:pb-0',
        className,
      )}
    >
      {stores.map((store, index) => (
        <li
          key={store.id}
          className="w-[78vw] max-w-sm lg:w-auto lg:max-w-none"
        >
          <StoreCard
            store={store}
            variant="rail"
            priority={priority && index === 0}
          />
        </li>
      ))}
    </ul>
  )
}
