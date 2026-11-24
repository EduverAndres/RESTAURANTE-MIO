'use client'

import { Building2Icon } from 'lucide-react'
import Link from 'next/link'
import { usePathname } from 'next/navigation'
import {
  COMPANY_ROLE_LABELS,
  type CompanyMemberRole,
} from '@/lib/companies/vocabulary'
import { cn } from '@/lib/utils'

const LINKS = [
  { href: '/empresa', label: 'Resumen', admin: false },
  { href: '/empresa/equipo', label: 'Equipo', admin: true },
  { href: '/empresa/pedidos', label: 'Pedidos', admin: false },
  {
    href: '/empresa/estados-de-cuenta',
    label: 'Estados de cuenta',
    admin: true,
  },
] as const

/**
 * The company panel's sections. A member sees their summary and their
 * orders; an admin also manages the team and reads the statements. Scrolls
 * sideways on a narrow phone rather than wrapping into two rows.
 */
export function CompanyNav({
  companyName,
  role,
}: {
  companyName: string
  role: CompanyMemberRole
}) {
  const pathname = usePathname()
  const links = LINKS.filter((link) => !link.admin || role === 'admin')

  return (
    <div className="space-y-3 print:hidden">
      <p className="text-muted-foreground flex items-center gap-2 text-sm">
        <Building2Icon aria-hidden="true" className="text-primary size-4" />
        <span className="text-foreground font-medium">{companyName}</span>
        <span aria-hidden="true">·</span>
        {COMPANY_ROLE_LABELS[role]}
      </p>
      <nav
        aria-label="Cuenta de empresa"
        className="-mx-4 overflow-x-auto px-4"
      >
        <ul className="bg-muted rounded-pill inline-flex gap-1 p-1">
          {links.map((link) => {
            const current =
              link.href === '/empresa'
                ? pathname === '/empresa'
                : pathname === link.href || pathname.startsWith(`${link.href}/`)
            return (
              <li key={link.href}>
                <Link
                  href={link.href}
                  aria-current={current ? 'page' : undefined}
                  className={cn(
                    'rounded-pill inline-flex h-10 items-center px-4 text-sm font-medium whitespace-nowrap transition-colors',
                    current
                      ? 'bg-background text-foreground shadow-1'
                      : 'text-foreground/75 hover:text-foreground hover:bg-background/60',
                  )}
                >
                  {link.label}
                </Link>
              </li>
            )
          })}
        </ul>
      </nav>
    </div>
  )
}
