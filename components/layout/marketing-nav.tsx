'use client'

import Link from 'next/link'
import { usePathname } from 'next/navigation'
import { cn } from '@/lib/utils'

const LINKS = [
  { href: '/', label: 'Pedir comida' },
  { href: '/para-restaurantes', label: 'Restaurantes' },
  { href: '/repartidores', label: 'Domiciliarios' },
  { href: '/empresas', label: 'Empresas' },
] as const

/**
 * The audience landings, one hop from each other, from `lg` up. The current
 * one is marked (`aria-current`), so an owner who wandered onto the courier
 * page can tell where they are and get back.
 */
export function MarketingNav() {
  const pathname = usePathname()

  return (
    <nav aria-label="Principal" className="mr-2 hidden lg:block">
      <ul className="flex items-center gap-1 text-sm font-medium">
        {LINKS.map((link) => {
          const current =
            link.href === '/'
              ? false
              : pathname === link.href || pathname.startsWith(`${link.href}/`)
          return (
            <li key={link.href}>
              <Link
                href={link.href}
                aria-current={current ? 'page' : undefined}
                className={cn(
                  'rounded-pill inline-flex h-11 items-center px-3 transition-colors',
                  current
                    ? 'bg-primary/10 text-primary-on-tint'
                    : 'text-muted-foreground hover:bg-muted hover:text-foreground',
                )}
              >
                {link.label}
              </Link>
            </li>
          )
        })}
      </ul>
    </nav>
  )
}
