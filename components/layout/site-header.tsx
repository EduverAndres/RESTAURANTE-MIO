import Link from 'next/link'
import { UserMenu } from '@/components/layout/user-menu'
import { ThemeToggle } from '@/components/theme/theme-toggle'
import { Button } from '@/components/ui/button'
import { getCurrentUser } from '@/lib/auth'
import { APP_NAME } from '@/lib/env'

export function Wordmark({ className }: { className?: string }) {
  return (
    <Link
      href="/"
      className={`font-display font-display-soft text-foreground text-2xl font-semibold tracking-tight ${className ?? ''}`}
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
      <div className="container-page flex h-16 items-center justify-between gap-4">
        <Wordmark />

        <nav
          aria-label="Principal"
          className="hidden items-center gap-1 text-sm font-medium md:flex"
        >
          <Link
            href="/"
            className="rounded-pill text-muted-foreground hover:bg-muted hover:text-foreground px-3 py-1.5 transition-colors"
          >
            Inicio
          </Link>
          <Link
            href="/#restaurantes"
            className="rounded-pill text-muted-foreground hover:bg-muted hover:text-foreground px-3 py-1.5 transition-colors"
          >
            Restaurantes
          </Link>
        </nav>

        <div className="flex items-center gap-1.5">
          <ThemeToggle />
          {current ? (
            <UserMenu
              name={displayName}
              email={current.user.email ?? ''}
              role={current.role}
              avatarUrl={current.profile?.avatar_url ?? null}
            />
          ) : (
            <Button asChild className="rounded-pill px-4">
              <Link href="/login">Iniciar sesión</Link>
            </Button>
          )}
        </div>
      </div>
    </header>
  )
}
