import { MobileNav } from '@/components/layout/mobile-nav'
import { SiteHeader } from '@/components/layout/site-header'
import { requireUser } from '@/lib/auth'

export default async function ProtectedLayout({
  children,
}: Readonly<{ children: React.ReactNode }>) {
  await requireUser('/account')

  return (
    <div className="flex min-h-dvh flex-col pb-20 md:pb-0">
      <SiteHeader />
      <main id="contenido" className="flex-1">
        {children}
      </main>
      <MobileNav />
    </div>
  )
}
