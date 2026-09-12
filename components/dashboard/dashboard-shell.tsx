'use client'

import {
  BarChart3Icon,
  ClipboardListIcon,
  LandmarkIcon,
  LayoutDashboardIcon,
  LogOutIcon,
  MenuIcon,
  PaletteIcon,
  QrCodeIcon,
  ReceiptTextIcon,
  SettingsIcon,
  StoreIcon,
  UsersIcon,
  UtensilsIcon,
} from 'lucide-react'
import Link from 'next/link'
import { useState } from 'react'
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

function SignOutButton({ className }: { className?: string }) {
  return (
    <form action="/auth/sign-out" method="post" className={className}>
      <Button
        type="submit"
        variant="ghost"
        size="sm"
        className="rounded-control w-full justify-start gap-2"
      >
        <LogOutIcon aria-hidden="true" />
        Cerrar sesión
      </Button>
    </form>
  )
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
  const items = variant === 'admin' ? ADMIN_ITEMS : MERCHANT_ITEMS
  const title = SHELL_TITLES[variant]
  const switcher =
    variant === 'merchant' && stores.length > 0 ? (
      <StoreSwitcher stores={stores} activeId={activeStoreId ?? stores[0].id} />
    ) : null

  const identity = (
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
    <div className="min-h-dvh lg:grid lg:grid-cols-[260px_1fr] print:block">
      <aside className="border-border/60 bg-sidebar hidden border-r lg:flex lg:flex-col print:hidden">
        <div className="flex h-16 items-center px-5">
          <Link
            href="/"
            className="font-display font-display-soft text-2xl font-semibold tracking-tight"
          >
            {appName}
            <span className="text-primary">.</span>
          </Link>
        </div>
        <p className="text-muted-foreground px-5 pb-2 text-xs font-medium tracking-wide uppercase">
          {title}
        </p>
        <DashboardNav items={items} className="px-3" />
        <div className="mt-auto space-y-2 p-3">
          {identity}
          <SignOutButton />
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
                  {identity}
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
