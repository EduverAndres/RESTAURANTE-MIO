'use client'

import { motion } from 'framer-motion'
import { TabsList, TabsTrigger } from '@/components/ui/tabs'
import { cn } from '@/lib/utils'

/**
 * Tabs whose active marker is a pill that glides from tab to tab.
 *
 * The pill is one Motion element shared through `layoutId`, rendered inside
 * whichever trigger is active; Motion animates it between positions. With
 * reduced motion (system or app, see MotionProvider) layout animations are
 * off and the pill simply appears on the new tab. Radix keeps the tab
 * semantics, arrow keys and focus. Every trigger is 44px tall.
 */
export function PillTabsList({
  className,
  ...props
}: React.ComponentProps<typeof TabsList>) {
  return (
    <TabsList
      className={cn(
        'bg-muted rounded-pill h-auto gap-1 p-1 group-data-horizontal/tabs:h-auto',
        className,
      )}
      {...props}
    />
  )
}

export function PillTabsTrigger({
  active,
  layoutId,
  className,
  children,
  ...props
}: React.ComponentProps<typeof TabsTrigger> & {
  /** Whether this trigger's value is the selected one. */
  active: boolean
  /** Unique per tab list on the page. */
  layoutId: string
}) {
  return (
    <TabsTrigger
      className={cn(
        'rounded-pill data-active:text-primary-foreground dark:data-active:text-primary-foreground relative h-11 px-4 text-sm data-active:bg-transparent data-active:shadow-none dark:data-active:border-transparent dark:data-active:bg-transparent',
        className,
      )}
      {...props}
    >
      {active ? (
        <motion.span
          layoutId={layoutId}
          className="bg-primary rounded-pill shadow-1 absolute inset-0"
          transition={{ type: 'spring', bounce: 0.18, duration: 0.5 }}
        />
      ) : null}
      <span className="relative inline-flex items-center gap-2">
        {children}
      </span>
    </TabsTrigger>
  )
}
