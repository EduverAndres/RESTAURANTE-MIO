'use client'

import {
  HouseIcon,
  ReceiptTextIcon,
  SearchIcon,
  UserRoundIcon,
} from 'lucide-react'
import Link from 'next/link'
import { usePathname } from 'next/navigation'
import { AccessibilityMenu } from '@/components/a11y/accessibility-menu'
import { cn } from '@/lib/utils'

const ITEMS = [
  {
    href: '/',
    label: 'Inicio',
    icon: HouseIcon,
    match: (p: string) => p === '/',
  },
  {
    href: '/#restaurantes',
    label: 'Buscar',
    icon: SearchIcon,
    match: () => false,
  },
  {
    href: '/account#pedidos',
    label: 'Pedidos',
    icon: ReceiptTextIcon,
    match: () => false,
  },
  {
    href: '/account',
    label: 'Perfil',
    icon: UserRoundIcon,
    match: (p: string) => p.startsWith('/account'),
  },
] as const

export function MobileNav() {
  const pathname = usePathname()

  return (
    <nav
      aria-label="Navegación móvil"
      className="border-border/60 bg-background/90 fixed inset-x-0 bottom-0 z-40 border-t pb-[env(safe-area-inset-bottom)] backdrop-blur-md md:hidden"
    >
      <ul className="grid grid-cols-5">
        {ITEMS.map(({ href, label, icon: Icon, match }) => {
          const active = match(pathname)
          return (
            <li key={label}>
              <Link
                href={href}
                aria-current={active ? 'page' : undefined}
                className={cn(
                  'flex flex-col items-center gap-1 px-2 py-2 text-[11px] font-medium transition-[color,transform] duration-150 active:scale-95',
                  active
                    ? 'text-primary'
                    : 'text-muted-foreground hover:text-foreground',
                )}
              >
                {/* The pill behind the active icon is the native tab bar's
                    cue: you can tell where you are without reading. */}
                <span
                  className={cn(
                    'rounded-pill grid h-7 w-12 place-items-center transition-colors duration-200',
                    active && 'bg-primary/12',
                  )}
                >
                  <Icon aria-hidden="true" className="size-5" />
                </span>
                {label}
              </Link>
            </li>
          )
        })}
        {/*
          The same preferences as the site header, within thumb reach: a
          customer who needs bigger text on a phone should not have to find a
          desktop header to get it.
        */}
        <li>
          <AccessibilityMenu variant="nav" />
        </li>
      </ul>
    </nav>
  )
}
