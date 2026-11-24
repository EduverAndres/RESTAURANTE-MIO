import { MobileNav } from '@/components/layout/mobile-nav'
import { SiteHeader } from '@/components/layout/site-header'
import { BfcacheGuard } from '@/components/auth/bfcache-guard'
import { requireUser } from '@/lib/auth'

export default async function ProtectedLayout({
  children,
}: Readonly<{ children: React.ReactNode }>) {
  await requireUser('/account')

  return (
    <>
      <BfcacheGuard />
      <div className="flex min-h-dvh flex-col pb-20 md:pb-0">
        {/* `contents` keeps the header sticky; `print:hidden` keeps the app
            chrome off a printed page (the company statements). */}
        <div className="contents print:hidden">
          <SiteHeader />
        </div>
        <main id="contenido" className="flex-1">
          {children}
        </main>
        <div className="contents print:hidden">
          <MobileNav />
        </div>
      </div>
    </>
  )
}
