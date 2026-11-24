import { LogInIcon } from 'lucide-react'
import Link from 'next/link'
import { AccessibilityMenu } from '@/components/a11y/accessibility-menu'
import { DesktopNav, MobileMenu } from '@/components/layout/site-nav'
import { NotificationBell } from '@/components/notifications/notification-bell'
import { UserMenu } from '@/components/layout/user-menu'
import { ThemeToggle } from '@/components/theme/theme-toggle'
import { Button } from '@/components/ui/button'
import { getCurrentUser } from '@/lib/auth'
import { APP_NAME } from '@/lib/env'

export function Wordmark({ className }: { className?: string }) {
  return (
    <Link
      href="/"
      className={`font-display font-display-soft text-foreground text-2xl font-semibold tracking-tight lowercase ${className ?? ''}`}
      aria-label={`${APP_NAME}, ir al inicio`}
    >
      {APP_NAME}
      <span className="text-primary">.</span>
    </Link>
  )
}

export async function SiteHeader() {
  const current = await getCurrentUser()

  const displayName =
    current?.profile?.full_name?.trim() ||
    current?.user.email?.split('@')[0] ||
    'Tu cuenta'

  return (
    <header className="border-border/60 bg-background/80 sticky top-0 z-40 border-b backdrop-blur-md">
      {/*
        First stop for a keyboard user on every page: it is visually hidden
        until focused, and jumps past the nav to the page's own content.
      */}
      <a
        href="#contenido"
        className="bg-background text-foreground rounded-control focus-visible:ring-ring sr-only px-4 py-2 text-sm font-medium shadow-lg focus-visible:not-sr-only focus-visible:absolute focus-visible:top-2 focus-visible:left-2 focus-visible:z-50 focus-visible:ring-2"
      >
        Saltar al contenido
      </a>
      <div className="container-page flex h-16 items-center justify-between gap-4">
        <Wordmark />

        <DesktopNav />

        {/* Below `md` the theme and accessibility controls live in the menu
            sheet (and the accessibility menu in the bottom bar too), so the
            row fits a 320px screen even with extra-large text. */}
        <div className="flex items-center gap-1">
          <AccessibilityMenu className="hidden size-11 md:inline-flex" />
          <ThemeToggle className="hidden size-11 md:inline-flex" />
          {current ? <NotificationBell userId={current.user.id} /> : null}
          {current ? (
            <UserMenu
              name={displayName}
              email={current.user.email ?? ''}
              role={current.role}
              avatarUrl={current.profile?.avatar_url ?? null}
            />
          ) : (
            <Button
              asChild
              className="rounded-pill h-11 px-4 max-sm:size-11 max-sm:px-0"
            >
              <Link href="/login">
                <LogInIcon aria-hidden="true" className="size-5 sm:hidden" />
                <span className="max-sm:sr-only">Iniciar sesión</span>
              </Link>
            </Button>
          )}
          <MobileMenu signedIn={Boolean(current)} />
        </div>
      </div>
    </header>
  )
}
