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
  className?: string
}

export function DashboardNav({
  items,
  onNavigate,
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
                  className="rounded-control text-muted-foreground/60 flex items-center gap-3 px-3 py-2 text-sm"
                >
                  <Icon aria-hidden="true" className="size-4" />
                  <span className="flex-1">{label}</span>
                  <Badge
                    variant="outline"
                    className="rounded-pill border-border/60 text-muted-foreground/70 px-1.5 text-[10px]"
                  >
                    {availableIn}
                  </Badge>
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
                className={cn(
                  'rounded-control flex items-center gap-3 px-3 py-2 text-sm font-medium transition-colors',
                  active
                    ? // Darker than `text-primary`: brand orange on a 10%
                      // brand tint measures 4.48:1, just under AA.
                      'bg-primary/10 text-primary-on-tint'
                    : 'text-muted-foreground hover:bg-muted hover:text-foreground',
                )}
              >
                <Icon aria-hidden="true" className="size-4" />
                {label}
              </Link>
            </li>
          )
        })}
      </ul>
    </nav>
  )
}
