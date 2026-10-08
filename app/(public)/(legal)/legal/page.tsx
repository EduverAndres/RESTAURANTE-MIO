import { ArrowRightIcon, FileTextIcon } from 'lucide-react'
import type { Metadata } from 'next'
import Link from 'next/link'
import { SiteFooter } from '@/components/layout/site-footer'
import { CompanyCard } from '@/components/legal/legal-document'
import { COMPANY } from '@/lib/legal/company'
import {
  LEGAL_DOCUMENTS,
  LEGAL_UPDATED_AT,
  LEGAL_VERSION,
} from '@/lib/legal/consent'

export const metadata: Metadata = {
  title: 'Legal',
  description: `Términos, privacidad, cookies y protección al consumidor de ${COMPANY.brand}.`,
}

export default function LegalIndexPage() {
  return (
    <>
      <div className="border-border/60 bg-secondary/40 border-b">
        <div className="container-page py-10 lg:py-14">
          <h1 className="text-h1 font-display font-semibold">Centro legal</h1>
          <p className="text-muted-foreground mt-3 max-w-2xl text-pretty">
            Todo lo que rige el uso de {COMPANY.brand}, escrito para que se
            entienda. Versión vigente {LEGAL_VERSION}, actualizada el{' '}
            {LEGAL_UPDATED_AT}.
          </p>
        </div>
      </div>

      <div className="container-page grid gap-10 py-10 lg:grid-cols-[minmax(0,1fr)_22rem] lg:py-14">
        <ul className="gap-card grid sm:grid-cols-2">
          {LEGAL_DOCUMENTS.map((document) => (
            <li key={document.key}>
              <Link
                href={document.href}
                className="group rounded-card bg-card shadow-1 hover:shadow-2 ring-foreground/5 p-card flex h-full flex-col gap-3 ring-1 transition-shadow"
              >
                <span className="rounded-control bg-primary/10 text-primary-on-tint grid size-10 place-items-center">
                  <FileTextIcon aria-hidden="true" className="size-5" />
                </span>
                <span className="font-display text-lg font-semibold">
                  {document.title}
                </span>
                <span className="text-muted-foreground flex-1 text-sm">
                  {document.summary}
                </span>
                <span className="text-primary-on-tint inline-flex items-center gap-1 text-sm font-medium">
                  Leer
                  <ArrowRightIcon
                    aria-hidden="true"
                    className="size-4 transition-transform group-hover:translate-x-0.5"
                  />
                </span>
              </Link>
            </li>
          ))}
        </ul>

        <div className="space-y-4">
          <CompanyCard />
          <p className="text-muted-foreground text-sm text-pretty">
            Autoridad de protección al consumidor y de datos personales:{' '}
            <a
              href="https://www.sic.gov.co"
              target="_blank"
              rel="noopener noreferrer"
              className="text-foreground underline underline-offset-2"
            >
              Superintendencia de Industria y Comercio
            </a>
            .
          </p>
        </div>
      </div>

      <SiteFooter />
    </>
  )
}
