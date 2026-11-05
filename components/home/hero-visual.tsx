import { MapPinIcon } from 'lucide-react'
import { VERTICALS } from '@/lib/marketplace/verticals'
import { cn } from '@/lib/utils'

/**
 * The hero's picture on wide screens: the marketplace as a shelf of verticals.
 *
 * It is a drawing of the product, not a screenshot of it, so it carries no
 * numbers, no store names and no order that never happened. It used to float
 * three trust promises around the edge; those already live in the trust bar
 * right below the hero, so here they only repeated it. Static on purpose:
 * nothing here changes state, so nothing here moves.
 */
export function HeroVisual({ className }: { className?: string }) {
  return (
    <div
      aria-hidden="true"
      className={cn(
        'mx-auto grid w-full max-w-md place-items-center',
        className,
      )}
    >
      <div className="rounded-card bg-card shadow-1 w-full p-5">
        <div className="mb-4 flex items-center justify-between">
          <span className="font-display text-lg font-semibold">
            Todo en un lugar
          </span>
          <span className="rounded-pill bg-primary/10 text-primary-on-tint inline-flex items-center gap-1 px-2 py-0.5 text-[11px] font-medium">
            <MapPinIcon className="size-3" />
            Barranquilla
          </span>
        </div>
        <ul className="grid grid-cols-4 gap-2.5">
          {VERTICALS.map(({ key, label, icon: Icon }) => (
            <li
              key={key}
              className="bg-secondary/70 flex flex-col items-center gap-1.5 rounded-2xl px-1 py-2.5"
            >
              <span className="bg-primary/10 text-primary-on-tint grid size-9 place-items-center rounded-xl">
                <Icon className="size-[18px]" strokeWidth={1.75} />
              </span>
              <span className="text-muted-foreground w-full truncate text-center text-[10px] font-medium">
                {label}
              </span>
            </li>
          ))}
        </ul>
      </div>
    </div>
  )
}
