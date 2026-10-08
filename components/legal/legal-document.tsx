import { AlertTriangleIcon, FileTextIcon } from 'lucide-react'
import Link from 'next/link'
import { SiteFooter } from '@/components/layout/site-footer'
import { COMPANY, COMPANY_INCOMPLETE } from '@/lib/legal/company'
import {
  LEGAL_DOCUMENTS,
  LEGAL_UPDATED_AT,
  LEGAL_VERSION,
  type LegalDocumentKey,
} from '@/lib/legal/consent'
import { cn } from '@/lib/utils'

export interface LegalSection {
  id: string
  title: string
  content: React.ReactNode
}

/**
 * The shared frame of every legal document: the same header, date, version,
 * table of contents and reading rhythm, so the five read as one body of
 * policy rather than five pages written on different days.
 *
 * Typography is set on the article itself (`[&_p]`, `[&_ul]`…) so the
 * sections can be written as plain JSX.
 */
export function LegalDocument({
  documentKey,
  title,
  intro,
  sections,
}: {
  documentKey: LegalDocumentKey
  title: string
  intro: React.ReactNode
  sections: LegalSection[]
}) {
  return (
    <>
      <div className="border-border/60 bg-secondary/40 border-b">
        <div className="container-page py-10 lg:py-14">
          <nav aria-label="Ruta" className="text-muted-foreground mb-4 text-sm">
            <Link
              href="/legal"
              className="hover:text-foreground underline-offset-4 hover:underline"
            >
              Legal
            </Link>
            <span aria-hidden="true"> / </span>
            <span className="text-foreground">{title}</span>
          </nav>
          <h1 className="text-h1 font-display max-w-3xl font-semibold">
            {title}
          </h1>
          <p className="text-muted-foreground mt-3 text-sm">
            Última actualización: {LEGAL_UPDATED_AT} · Versión {LEGAL_VERSION}
          </p>
        </div>
      </div>

      <div className="container-page grid gap-10 py-10 lg:grid-cols-[16rem_minmax(0,1fr)] lg:py-14">
        <aside className="lg:sticky lg:top-24 lg:self-start">
          <nav aria-label="Contenido del documento" className="space-y-6">
            <div>
              <h2 className="mb-2 text-xs font-semibold tracking-wide uppercase">
                En este documento
              </h2>
              <ol className="space-y-1.5 text-sm">
                {sections.map((section, index) => (
                  <li key={section.id}>
                    <a
                      href={`#${section.id}`}
                      className="text-muted-foreground hover:text-foreground flex gap-2"
                    >
                      <span className="tabular-nums">{index + 1}.</span>
                      {section.title}
                    </a>
                  </li>
                ))}
              </ol>
            </div>
            <div className="hidden lg:block">
              <h2 className="mb-2 text-xs font-semibold tracking-wide uppercase">
                Otros documentos
              </h2>
              <ul className="space-y-1.5 text-sm">
                {LEGAL_DOCUMENTS.filter((doc) => doc.key !== documentKey).map(
                  (doc) => (
                    <li key={doc.key}>
                      <Link
                        href={doc.href}
                        className="text-muted-foreground hover:text-foreground inline-flex gap-2"
                      >
                        <FileTextIcon
                          aria-hidden="true"
                          className="mt-0.5 size-4 shrink-0"
                        />
                        {doc.title}
                      </Link>
                    </li>
                  ),
                )}
              </ul>
            </div>
          </nav>
        </aside>

        <article
          className={cn(
            'max-w-3xl text-[15px] leading-relaxed',
            '[&_p]:text-muted-foreground [&_p]:mb-3 [&_p]:text-pretty',
            '[&_ul]:text-muted-foreground [&_ul]:mb-3 [&_ul]:list-disc [&_ul]:space-y-1.5 [&_ul]:pl-5',
            '[&_ol]:text-muted-foreground [&_ol]:mb-3 [&_ol]:list-decimal [&_ol]:space-y-1.5 [&_ol]:pl-5',
            '[&_strong]:text-foreground [&_strong]:font-semibold',
            '[&_h3]:text-foreground [&_h3]:mt-5 [&_h3]:mb-2 [&_h3]:font-semibold',
            '[&_a]:text-primary-on-tint [&_a]:underline [&_a]:underline-offset-2',
          )}
        >
          {COMPANY_INCOMPLETE ? (
            <div
              role="note"
              className="rounded-card border-accent/40 bg-accent/10 text-foreground mb-8 flex gap-3 border p-4 text-sm"
            >
              <AlertTriangleIcon
                aria-hidden="true"
                className="text-accent mt-0.5 size-5 shrink-0"
              />
              <span>
                <strong>Datos de la empresa pendientes.</strong> Este documento
                muestra marcadores entre corchetes que deben reemplazarse por la
                razón social, NIT, dirección y contactos reales antes de operar.
              </span>
            </div>
          ) : null}

          <div className="[&_p]:text-foreground mb-8 [&_p]:text-base">
            {intro}
          </div>

          {sections.map((section, index) => (
            <section
              key={section.id}
              id={section.id}
              aria-labelledby={`${section.id}-title`}
              className="border-border/60 scroll-mt-24 border-t py-6"
            >
              <h2
                id={`${section.id}-title`}
                className="font-display text-foreground mb-3 text-xl font-semibold"
              >
                {index + 1}. {section.title}
              </h2>
              {section.content}
            </section>
          ))}

          <CompanyCard />
        </article>
      </div>

      <SiteFooter />
    </>
  )
}

/** Ley 1480, art. 50: who the consumer is dealing with, and how to reach them. */
export function CompanyCard() {
  return (
    <div className="rounded-card bg-card shadow-1 ring-foreground/5 mt-6 p-5 ring-1">
      <h2 className="font-display mb-3 text-lg font-semibold">
        Identificación del responsable
      </h2>
      <dl className="grid gap-x-6 gap-y-2 text-sm sm:grid-cols-[auto_1fr]">
        <dt className="font-medium">Razón social</dt>
        <dd className="text-muted-foreground">{COMPANY.legalName}</dd>
        <dt className="font-medium">NIT</dt>
        <dd className="text-muted-foreground">{COMPANY.nit}</dd>
        <dt className="font-medium">Marca</dt>
        <dd className="text-muted-foreground">{COMPANY.brand}</dd>
        <dt className="font-medium">Domicilio</dt>
        <dd className="text-muted-foreground">{COMPANY.address}</dd>
        <dt className="font-medium">Correo</dt>
        <dd className="text-muted-foreground">{COMPANY.email}</dd>
        <dt className="font-medium">Datos personales</dt>
        <dd className="text-muted-foreground">{COMPANY.privacyEmail}</dd>
        <dt className="font-medium">Teléfono</dt>
        <dd className="text-muted-foreground">{COMPANY.phone}</dd>
      </dl>
    </div>
  )
}
