import { CompanyNav } from '@/components/companies/company-nav'
import { fetchMyCorporateBudget } from '@/lib/companies/server'

/**
 * The company panel. The (protected) layout already requires a session; the
 * navigation appears once the person belongs to a company, so the sign-up
 * and the invitation pages stand on their own.
 */
export default async function CompanyLayout({
  children,
}: Readonly<{ children: React.ReactNode }>) {
  const budget = await fetchMyCorporateBudget()

  return (
    <div className="container-page space-y-6 py-8 lg:py-12 print:py-0">
      {budget ? (
        <CompanyNav companyName={budget.companyName} role={budget.role} />
      ) : null}
      {children}
    </div>
  )
}
