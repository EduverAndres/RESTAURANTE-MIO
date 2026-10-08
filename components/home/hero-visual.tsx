'use client'

import {
  motion,
  useReducedMotion,
  useScroll,
  useTransform,
} from 'framer-motion'
import { BadgeCheckIcon, MapPinIcon, ShieldCheckIcon } from 'lucide-react'
import { useRef } from 'react'
import { VERTICALS } from '@/lib/marketplace/verticals'
import { cn } from '@/lib/utils'

/**
 * The hero's picture: the marketplace as a shelf of verticals, with the three
 * promises that make a stranger trust it floating around the edge.
 *
 * It is a drawing of the product, not a screenshot of it, so it carries no
 * numbers, no store names and no order that never happened. The chips drift
 * on a slow loop and the layers part a little as the page scrolls — enough to
 * feel alive, never enough to compete with the search box beside it. Both
 * motions switch off under reduced motion.
 */
export function HeroVisual({ className }: { className?: string }) {
  const ref = useRef<HTMLDivElement>(null)
  const reduceMotion = useReducedMotion()
  const { scrollYProgress } = useScroll({
    target: ref,
    offset: ['start start', 'end start'],
  })
  const back = useTransform(scrollYProgress, [0, 1], [0, reduceMotion ? 0 : 40])
  const front = useTransform(
    scrollYProgress,
    [0, 1],
    [0, reduceMotion ? 0 : -60],
  )

  return (
    <div
      ref={ref}
      aria-hidden="true"
      className={cn(
        'relative mx-auto aspect-square w-full max-w-md',
        className,
      )}
    >
      {/* Two soft rings: depth without a single extra colour. */}
      <motion.div style={{ y: back }} className="absolute inset-0">
        <div className="border-primary/15 absolute inset-[6%] rounded-full border" />
        <div className="border-accent/20 absolute inset-[18%] rounded-full border border-dashed" />
        <div className="bg-primary/10 absolute inset-[30%] rounded-full blur-3xl" />
      </motion.div>

      {/* The shelf. */}
      <div className="absolute inset-x-[6%] inset-y-[14%] grid place-items-center">
        <div className="rounded-card bg-card/90 shadow-3 ring-foreground/5 w-full p-5 ring-1 backdrop-blur-sm">
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
            {VERTICALS.map(({ key, label, icon: Icon }, index) => (
              <li
                key={key}
                className="bg-secondary/70 flex flex-col items-center gap-1.5 rounded-2xl px-1 py-2.5"
              >
                <span
                  className="animate-float from-primary/15 to-accent/20 text-primary-on-tint grid size-9 place-items-center rounded-xl bg-gradient-to-br"
                  style={{ animationDelay: `${index * 0.35}s` }}
                >
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

      {/* The promises, each on its own layer of the parallax. */}
      <motion.div style={{ y: front }} className="absolute inset-0">
        <FloatingChip
          className="top-[6%] left-[4%]"
          delay="0s"
          icon={<BadgeCheckIcon className="text-success size-4" />}
          label="Comercios verificados"
        />
        <FloatingChip
          className="right-[0%] bottom-[12%]"
          delay="1.2s"
          icon={
            <span className="relative flex size-2.5">
              <span className="bg-primary absolute inline-flex size-full animate-ping rounded-full opacity-60" />
              <span className="bg-primary relative inline-flex size-2.5 rounded-full" />
            </span>
          }
          label="Seguimiento en vivo"
        />
        <FloatingChip
          className="bottom-[2%] left-[6%]"
          delay="2.4s"
          icon={<ShieldCheckIcon className="text-primary size-4" />}
          label="Pagos protegidos"
        />
      </motion.div>
    </div>
  )
}

function FloatingChip({
  className,
  delay,
  icon,
  label,
}: {
  className: string
  delay: string
  icon: React.ReactNode
  label: string
}) {
  return (
    <span
      className={cn(
        'rounded-pill bg-card shadow-2 ring-foreground/5 animate-float absolute inline-flex items-center gap-2 px-3.5 py-2 text-sm font-medium ring-1',
        className,
      )}
      style={{ animationDelay: delay }}
    >
      {icon}
      {label}
    </span>
  )
}
