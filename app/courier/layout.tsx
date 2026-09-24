import { LogOutIcon } from 'lucide-react'
import type { Metadata } from 'next'
import { Wordmark } from '@/components/layout/site-header'
import { PushToggle } from '@/components/notifications/push-toggle'
import { SoundToggle } from '@/components/notifications/sound-toggle'
import { ThemeToggle } from '@/components/theme/theme-toggle'
import { Button } from '@/components/ui/button'
import { requireRole } from '@/lib/auth'
import { APP_NAME } from '@/lib/env'
import { pushConfigured } from '@/lib/env.server'

export const metadata: Metadata = {
  title: {
    default: 'Mis entregas',
    template: `%s · Domiciliario · ${APP_NAME}`,
  },
}

export default async function CourierLayout({
  children,
}: Readonly<{ children: React.ReactNode }>) {
  const { user, profile } = await requireRole(['courier', 'admin'], '/courier')
  const name =
    profile?.full_name?.trim() || user.email?.split('@')[0] || 'Domiciliario'

  return (
    <div className="flex min-h-dvh flex-col">
      <header className="border-border/60 bg-background/80 sticky top-0 z-40 border-b backdrop-blur-md">
        <div className="container-page flex h-16 items-center justify-between gap-3">
          <div className="flex items-center gap-3">
            <Wordmark />
            <span className="text-muted-foreground hidden text-sm sm:inline">
              Domiciliario · {name}
            </span>
          </div>
          <div className="flex items-center gap-1.5">
            <PushToggle enabled={pushConfigured()} className="hidden sm:flex" />
            <SoundToggle compact className="hidden sm:flex" />
            <ThemeToggle />
            <form action="/auth/sign-out" method="post">
              <Button
                type="submit"
                variant="ghost"
                size="sm"
                className="rounded-pill"
              >
                <LogOutIcon aria-hidden="true" />
                <span className="hidden sm:inline">Cerrar sesión</span>
              </Button>
            </form>
          </div>
        </div>
      </header>
      <main className="container-page flex-1 py-8">{children}</main>
    </div>
  )
}
