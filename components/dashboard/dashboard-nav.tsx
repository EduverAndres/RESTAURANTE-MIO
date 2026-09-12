'use client'

import type { LucideIcon } from 'lucide-react'
import Link from 'next/link'
import { usePathname } from 'next/navigation'
import { Badge } from '@/components/ui/badge'
import { cn } from '@/lib/utils'

export interface DashboardNavItem {
  label: string
  href: string
  icon: LucideIcon
  /** When set, the item is rendered as a muted, non-interactive entry. */
  availableIn?: string
}

interface DashboardNavProps {
  items: DashboardNavItem[]
  onNavigate?: () => void
  /** Icons only, with the label kept for assistive technology. */
  collapsed?: boolean
  className?: string
}

export function DashboardNav({
  items,
  onNavigate,
  collapsed = false,
  className,
}: DashboardNavProps) {
  const pathname = usePathname()

  return (
    <nav aria-label="Secciones del panel" className={className}>
      <ul className="space-y-1">
        {items.map(({ label, href, icon: Icon, availableIn }) => {
          const active = pathname === href || pathname.startsWith(`${href}/`)

          if (availableIn) {
            return (
              <li key={label}>
                <span
                  aria-disabled="true"
                  title={collapsed ? label : undefined}
                  className={cn(
                    'rounded-control text-muted-foreground/60 flex items-center gap-3 px-3 py-2 text-sm',
                    collapsed && 'justify-center px-0',
                  )}
                >
                  <Icon aria-hidden="true" className="size-4 shrink-0" />
                  <span className={cn('flex-1', collapsed && 'sr-only')}>
                    {label}
                  </span>
                  {collapsed ? null : (
                    <Badge
                      variant="outline"
                      className="rounded-pill border-border/60 text-muted-foreground/70 px-1.5 text-[10px]"
                    >
                      {availableIn}
                    </Badge>
                  )}
                </span>
              </li>
            )
          }

          return (
            <li key={label}>
              <Link
                href={href}
                onClick={onNavigate}
                aria-current={active ? 'page' : undefined}
                // The native tooltip is the only affordance a collapsed rail
                // can offer a mouse; the label itself never leaves the DOM,
                // so the link keeps its accessible name either way.
                title={collapsed ? label : undefined}
                className={cn(
                  'rounded-control flex items-center gap-3 px-3 py-2 text-sm font-medium transition-colors',
                  collapsed && 'justify-center px-0',
                  active
                    ? // Darker than `text-primary`: brand orange on a 10%
                      // brand tint measures 4.48:1, just under AA.
                      'bg-primary/10 text-primary-on-tint'
                    : 'text-muted-foreground hover:bg-muted hover:text-foreground',
                )}
              >
                <Icon aria-hidden="true" className="size-4 shrink-0" />
                <span className={cn(collapsed && 'sr-only')}>{label}</span>
              </Link>
            </li>
          )
        })}
      </ul>
    </nav>
  )
}
