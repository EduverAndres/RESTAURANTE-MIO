'use client'

import {
  BikeIcon,
  Building2Icon,
  CalendarCheckIcon,
  ChevronDownIcon,
  HouseIcon,
  LogInIcon,
  MenuIcon,
  SearchIcon,
  StoreIcon,
  type LucideIcon,
} from 'lucide-react'
import Link from 'next/link'
import { usePathname } from 'next/navigation'
import { AccessibilityMenu } from '@/components/a11y/accessibility-menu'
import { ThemeToggle } from '@/components/theme/theme-toggle'
import { Button } from '@/components/ui/button'
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from '@/components/ui/dropdown-menu'
import {
  Sheet,
  SheetClose,
  SheetContent,
  SheetDescription,
  SheetFooter,
  SheetHeader,
  SheetTitle,
  SheetTrigger,
} from '@/components/ui/sheet'
import { cn } from '@/lib/utils'

interface NavLink {
  href: string
  label: string
  icon: LucideIcon
  description?: string
}

/** The marketplace's own sections. */
const PRIMARY: readonly NavLink[] = [
  { href: '/#restaurantes', label: 'Explorar', icon: SearchIcon },
  { href: '/reservas', label: 'Reservar', icon: CalendarCheckIcon },
  { href: '/empresas', label: 'Empresas', icon: Building2Icon },
]

/** "Únete": the two ways to work with Cerquita rather than buy from it. */
const JOIN: readonly NavLink[] = [
  {
    href: '/para-restaurantes',
    label: 'Restaurantes',
    description: 'Vende con tu marca',
    icon: StoreIcon,
  },
  {
    href: '/repartidores',
    label: 'Domiciliarios',
    description: 'Gana entregando',
    icon: BikeIcon,
  },
]

function isCurrent(pathname: string, href: string): boolean {
  if (href.includes('#')) return false
  return pathname === href || pathname.startsWith(`${href}/`)
}

const LINK_CLASS =
  'rounded-pill inline-flex h-11 items-center gap-1 px-3 transition-colors'

/**
 * Header navigation from `md` up: Explorar · Reservar · Empresas · Únete,
 * the last one a menu with the two audiences that join the platform. Radix
 * owns the menu's keyboard handling and returns focus to "Únete" on close.
 */
export function DesktopNav() {
  const pathname = usePathname()

  return (
    <nav aria-label="Principal" className="hidden md:block">
      <ul className="flex items-center gap-0.5 text-sm font-medium">
        {PRIMARY.map((link) => {
          const current = isCurrent(pathname, link.href)
          return (
            <li key={link.href}>
              <Link
                href={link.href}
                aria-current={current ? 'page' : undefined}
                className={cn(
                  LINK_CLASS,
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
        <li>
          <DropdownMenu>
            <DropdownMenuTrigger
              className={cn(
                LINK_CLASS,
                'text-muted-foreground hover:bg-muted hover:text-foreground aria-expanded:bg-muted aria-expanded:text-foreground',
              )}
            >
              Únete
              <ChevronDownIcon aria-hidden="true" className="size-4" />
            </DropdownMenuTrigger>
            <DropdownMenuContent align="end" className="w-64 rounded-2xl p-1.5">
              {JOIN.map(({ href, label, description, icon: Icon }) => (
                <DropdownMenuItem
                  key={href}
                  asChild
                  className="gap-3 rounded-xl p-2.5"
                >
                  <Link href={href}>
                    <span className="bg-primary/10 text-primary-on-tint rounded-control grid size-9 shrink-0 place-items-center">
                      <Icon aria-hidden="true" className="size-4" />
                    </span>
                    <span className="min-w-0">
                      <span className="block text-sm font-medium">{label}</span>
                      <span className="text-muted-foreground block text-xs">
                        {description}
                      </span>
                    </span>
                  </Link>
                </DropdownMenuItem>
              ))}
            </DropdownMenuContent>
          </DropdownMenu>
        </li>
      </ul>
    </nav>
  )
}

function SheetLinkList({
  id,
  title,
  links,
  pathname,
}: {
  id: string
  title: string
  links: readonly NavLink[]
  pathname: string
}) {
  return (
    <div className="space-y-1">
      <p
        id={id}
        className="text-muted-foreground px-3 text-xs font-semibold tracking-wide uppercase"
      >
        {title}
      </p>
      <ul aria-labelledby={id}>
        {links.map(({ href, label, description, icon: Icon }) => {
          const current = isCurrent(pathname, href)
          return (
            <li key={href}>
              <SheetClose asChild>
                <Link
                  href={href}
                  aria-current={current ? 'page' : undefined}
                  className={cn(
                    'flex min-h-12 items-center gap-3 rounded-xl px-3 py-2 transition-colors',
                    current ? 'bg-primary/10' : 'hover:bg-muted',
                  )}
                >
                  <Icon
                    aria-hidden="true"
                    className="text-primary-on-tint size-5 shrink-0"
                  />
                  <span className="min-w-0">
                    <span className="block text-base font-medium">{label}</span>
                    {description ? (
                      <span className="text-muted-foreground block text-xs">
                        {description}
                      </span>
                    ) : null}
                  </span>
                </Link>
              </SheetClose>
            </li>
          )
        })}
      </ul>
    </div>
  )
}

/**
 * Every link of the header below `md`, behind one menu button: the desktop
 * nav, the "Únete" audiences, the theme and accessibility controls that do
 * not fit next to it on a phone, and the way in for a visitor who is not
 * signed in. Radix traps focus, closes on Escape and returns focus to the
 * button; every link closes the sheet as it navigates.
 */
export function MobileMenu({ signedIn }: { signedIn: boolean }) {
  const pathname = usePathname()

  return (
    <Sheet>
      <SheetTrigger asChild>
        <Button
          type="button"
          variant="ghost"
          size="icon"
          aria-label="Abrir menú"
          className="rounded-pill size-11 md:hidden"
        >
          <MenuIcon aria-hidden="true" className="size-5" />
        </Button>
      </SheetTrigger>
      <SheetContent side="right" className="w-[min(88vw,22rem)] gap-0">
        <SheetHeader className="border-border/60 border-b">
          <SheetTitle className="font-display text-xl font-semibold">
            Menú
          </SheetTitle>
          <SheetDescription className="sr-only">
            Secciones del sitio, preferencias y acceso a tu cuenta.
          </SheetDescription>
        </SheetHeader>
        <nav
          aria-label="Menú del sitio"
          className="flex-1 space-y-6 overflow-y-auto p-3"
        >
          <SheetLinkList
            id="menu-pedir"
            title="Pedir y reservar"
            links={[
              { href: '/', label: 'Inicio', icon: HouseIcon },
              ...PRIMARY.filter((link) => link.href !== '/empresas'),
            ]}
            pathname={pathname}
          />
          <SheetLinkList
            id="menu-empresas"
            title="Empresas"
            links={[
              {
                href: '/empresas',
                label: 'Cuenta empresarial',
                description: 'Domicilios para tu equipo',
                icon: Building2Icon,
              },
            ]}
            pathname={pathname}
          />
          <SheetLinkList
            id="menu-unete"
            title="Únete"
            links={JOIN}
            pathname={pathname}
          />
        </nav>
        <SheetFooter className="border-border/60 border-t">
          <div className="flex items-center justify-between gap-3">
            <span className="text-muted-foreground text-sm">Preferencias</span>
            <span className="flex items-center gap-1">
              <AccessibilityMenu className="size-11" />
              <ThemeToggle className="size-11" />
            </span>
          </div>
          {signedIn ? null : (
            <SheetClose asChild>
              <Button asChild size="lg" className="rounded-pill h-12 text-base">
                <Link href="/login">
                  <LogInIcon aria-hidden="true" data-icon="inline-start" />
                  Iniciar sesión
                </Link>
              </Button>
            </SheetClose>
          )}
        </SheetFooter>
      </SheetContent>
    </Sheet>
  )
}
