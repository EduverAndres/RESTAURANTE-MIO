'use client'

import {
  BarChart3Icon,
  ClipboardListIcon,
  LandmarkIcon,
  LayoutDashboardIcon,
  LogOutIcon,
  MenuIcon,
  PaletteIcon,
  PanelLeftCloseIcon,
  PanelLeftOpenIcon,
  QrCodeIcon,
  ReceiptTextIcon,
  SettingsIcon,
  StoreIcon,
  TriangleAlertIcon,
  UsersIcon,
  UtensilsIcon,
} from 'lucide-react'
import Link from 'next/link'
import { useEffect, useState } from 'react'
import {
  DashboardNav,
  type DashboardNavItem,
} from '@/components/dashboard/dashboard-nav'
import {
  StoreSwitcher,
  type StoreSwitcherStore,
} from '@/components/dashboard/store-switcher'
import { initialsOf } from '@/lib/format'
import { PushToggle } from '@/components/notifications/push-toggle'
import { ThemeToggle } from '@/components/theme/theme-toggle'
import { Avatar, AvatarFallback } from '@/components/ui/avatar'
import { Button } from '@/components/ui/button'
import {
  Sheet,
  SheetContent,
  SheetDescription,
  SheetHeader,
  SheetTitle,
  SheetTrigger,
} from '@/components/ui/sheet'
import { ROLE_LABELS } from '@/lib/orders/status'
import { cn } from '@/lib/utils'
import type { UserRole } from '@/types/app'

const MERCHANT_ITEMS: DashboardNavItem[] = [
  { label: 'Pedidos', href: '/dashboard', icon: ReceiptTextIcon },
  { label: 'Menú', href: '/dashboard/menu', icon: UtensilsIcon },
  { label: 'Tienda', href: '/dashboard/store', icon: PaletteIcon },
  { label: 'Clientes', href: '/dashboard/customers', icon: UsersIcon },
  { label: 'Métricas', href: '/dashboard/metrics', icon: BarChart3Icon },
  { label: 'Mesas', href: '/dashboard/tables', icon: QrCodeIcon },
  { label: 'Liquidaciones', href: '/dashboard/payouts', icon: LandmarkIcon },
  { label: 'Configuración', href: '/dashboard/settings', icon: SettingsIcon },
]

const ADMIN_ITEMS: DashboardNavItem[] = [
  { label: 'Resumen', href: '/admin', icon: LayoutDashboardIcon },
  { label: 'Tiendas', href: '/admin/stores', icon: StoreIcon },
  { label: 'Usuarios', href: '/admin/users', icon: UsersIcon },
  { label: 'Liquidaciones', href: '/admin/payouts', icon: LandmarkIcon },
  { label: 'Pagos sin aplicar', href: '/admin/payments', icon: TriangleAlertIcon },
  { label: 'Métricas', href: '/admin/metrics', icon: ClipboardListIcon },
]

const SHELL_TITLES = {
  merchant: 'Panel del restaurante',
  admin: 'Administración',
} as const

interface DashboardShellProps {
  variant: 'merchant' | 'admin'
  appName: string
  user: { name: string; email: string; role: UserRole }
  /** Merchant variant only: stores the owner can switch between. */
  stores?: StoreSwitcherStore[]
  activeStoreId?: string
  /** Server-computed `pushConfigured()`; hides the toggle when false. */
  pushEnabled?: boolean
  children: React.ReactNode
}

function SignOutButton({
  className,
  collapsed = false,
}: {
  className?: string
  collapsed?: boolean
}) {
  return (
    <form action="/auth/sign-out" method="post" className={className}>
      <Button
        type="submit"
        variant="ghost"
        size="sm"
        title={collapsed ? 'Cerrar sesión' : undefined}
        className={cn(
          'rounded-control w-full gap-2',
          collapsed ? 'justify-center px-0' : 'justify-start',
        )}
      >
        <LogOutIcon aria-hidden="true" />
        <span className={cn(collapsed && 'sr-only')}>Cerrar sesión</span>
      </Button>
    </form>
  )
}

/**
 * Remembering the choice is the whole point: a merchant who works all day in
 * Pedidos collapses the rail once and gets the width back for good. It is
 * read after mount rather than during render so the server and client markup
 * agree, and the width transition is suppressed until then so the sidebar
 * does not visibly slide on every page load.
 */
const COLLAPSED_KEY = 'dashboard:sidebar-collapsed'

function useSidebarCollapsed() {
  const [collapsed, setCollapsed] = useState(false)
  const [ready, setReady] = useState(false)

  useEffect(() => {
    try {
      setCollapsed(window.localStorage.getItem(COLLAPSED_KEY) === '1')
    } catch {
      // Storage disabled; the rail simply starts expanded.
    }
    setReady(true)
  }, [])

  function toggle() {
    setCollapsed((current) => {
      const next = !current
      try {
        window.localStorage.setItem(COLLAPSED_KEY, next ? '1' : '0')
      } catch {
        // Nothing to do: the preference is a convenience, not state.
      }
      return next
    })
  }

  return { collapsed, ready, toggle }
}

export function DashboardShell({
  variant,
  appName,
  user,
  stores = [],
  activeStoreId,
  pushEnabled = false,
  children,
}: DashboardShellProps) {
  const [open, setOpen] = useState(false)
  const { collapsed, ready, toggle } = useSidebarCollapsed()
  const items = variant === 'admin' ? ADMIN_ITEMS : MERCHANT_ITEMS
  const title = SHELL_TITLES[variant]
  const switcher =
    variant === 'merchant' && stores.length > 0 ? (
      <StoreSwitcher stores={stores} activeId={activeStoreId ?? stores[0].id} />
    ) : null

  const identity = (compact = false) =>
    compact ? (
      <div className="flex justify-center">
        <Avatar className="size-9">
          <AvatarFallback
            className="bg-primary/12 text-primary-on-tint text-xs font-semibold"
            title={`${user.name} · ${ROLE_LABELS[user.role]}`}
          >
            {initialsOf(user.name)}
          </AvatarFallback>
        </Avatar>
      </div>
    ) : (
      <div className="rounded-card bg-muted/60 flex items-center gap-3 p-3">
        <Avatar className="size-9">
          <AvatarFallback className="bg-primary/12 text-primary-on-tint text-xs font-semibold">
            {initialsOf(user.name)}
          </AvatarFallback>
        </Avatar>
        <div className="min-w-0">
          <p className="truncate text-sm font-medium">{user.name}</p>
          <p className="text-muted-foreground truncate text-xs">
            {ROLE_LABELS[user.role]}
          </p>
        </div>
      </div>
    )

  return (
    <div
      className={cn(
        'min-h-dvh print:block',
        collapsed
          ? 'lg:grid lg:grid-cols-[4.5rem_1fr]'
          : 'lg:grid lg:grid-cols-[260px_1fr]',
        ready &&
          'lg:ease-out-soft lg:transition-[grid-template-columns] lg:duration-200',
      )}
    >
      <aside
        id="dashboard-sidebar"
        className="border-border/60 bg-sidebar hidden border-r lg:flex lg:flex-col print:hidden"
      >
        <div
          className={cn(
            'flex h-16 items-center',
            collapsed ? 'justify-center px-0' : 'px-5',
          )}
        >
          <Link
            href="/"
            className="font-display font-display-soft text-2xl font-semibold tracking-tight"
          >
            {collapsed ? (
              <>
                {appName.slice(0, 1)}
                <span className="sr-only">{appName.slice(1)}</span>
              </>
            ) : (
              appName
            )}
            <span className="text-primary">.</span>
          </Link>
        </div>
        {collapsed ? null : (
          <p className="text-muted-foreground px-5 pb-2 text-xs font-medium tracking-wide uppercase">
            {title}
          </p>
        )}
        <DashboardNav
          items={items}
          collapsed={collapsed}
          className={collapsed ? 'px-2' : 'px-3'}
        />
        <div className={cn('mt-auto space-y-2', collapsed ? 'p-2' : 'p-3')}>
          <Button
            type="button"
            variant="ghost"
            size="sm"
            onClick={toggle}
            aria-expanded={!collapsed}
            aria-controls="dashboard-sidebar"
            className={cn(
              'rounded-control w-full gap-2',
              collapsed ? 'justify-center px-0' : 'justify-start',
            )}
          >
            {collapsed ? (
              <PanelLeftOpenIcon aria-hidden="true" />
            ) : (
              <PanelLeftCloseIcon aria-hidden="true" />
            )}
            <span className={cn(collapsed && 'sr-only')}>
              {collapsed ? 'Expandir menú' : 'Contraer menú'}
            </span>
          </Button>
          {identity(collapsed)}
          <SignOutButton collapsed={collapsed} />
        </div>
      </aside>

      <div className="flex min-h-dvh flex-col">
        <header className="border-border/60 bg-background/80 sticky top-0 z-30 flex h-16 items-center justify-between gap-3 border-b px-4 backdrop-blur-md sm:px-6 print:hidden">
          <div className="flex items-center gap-2">
            <Sheet open={open} onOpenChange={setOpen}>
              <SheetTrigger asChild>
                <Button
                  variant="ghost"
                  size="icon"
                  className="rounded-pill lg:hidden"
                  aria-label="Abrir navegación"
                >
                  <MenuIcon aria-hidden="true" />
                </Button>
              </SheetTrigger>
              <SheetContent side="left" className="w-80 p-0">
                <SheetHeader className="border-border/60 border-b px-5 py-4 text-left">
                  <SheetTitle className="font-display text-xl">
                    {appName}
                    <span className="text-primary">.</span>
                  </SheetTitle>
                  <SheetDescription>{title}</SheetDescription>
                </SheetHeader>
                <DashboardNav
                  items={items}
                  className="px-3 py-3"
                  onNavigate={() => setOpen(false)}
                />
                <div className="mt-auto space-y-2 p-3">
                  {identity()}
                  <SignOutButton />
                </div>
              </SheetContent>
            </Sheet>
            <span className="font-display text-lg font-semibold lg:hidden">
              {title}
            </span>
          </div>
          <div className="flex min-w-0 items-center gap-2">
            {switcher}
            <span className="text-muted-foreground hidden text-sm lg:inline">
              {user.email}
            </span>
            <PushToggle enabled={pushEnabled} className="hidden lg:flex" />
            <ThemeToggle />
          </div>
        </header>
        <main className="flex-1 px-4 py-6 sm:px-6 lg:px-8 lg:py-8 print:p-0">
          {children}
        </main>
      </div>
    </div>
  )
}
