'use client'

import { FileTextIcon, LoaderCircleIcon } from 'lucide-react'
import { useRouter } from 'next/navigation'
import { useState, useTransition } from 'react'
import { toast } from 'sonner'
import { acceptLegalTerms } from '../actions'
import { ConsentCheckbox } from '@/components/legal/consent-checkbox'
import { Button } from '@/components/ui/button'
import { LEGAL_DOCUMENTS } from '@/lib/legal/consent'

export function AcceptTermsForm({
  next,
  partner,
}: {
  next: string | null
  partner: boolean
}) {
  const router = useRouter()
  const [accepted, setAccepted] = useState(false)
  const [error, setError] = useState<string | undefined>()
  const [pending, startTransition] = useTransition()

  const documents = LEGAL_DOCUMENTS.filter(
    (document) => partner || document.key !== 'aliados',
  )

  function accept(event: React.FormEvent) {
    event.preventDefault()
    if (!accepted) {
      setError(
        'Debes aceptar los Términos y la Política de Tratamiento de Datos para continuar.',
      )
      return
    }
    setError(undefined)
    startTransition(async () => {
      const result = await acceptLegalTerms('gate', next)
      if (!result.ok) {
        toast.error(result.error)
        return
      }
      router.push(result.redirectTo)
      router.refresh()
    })
  }

  return (
    <div className="space-y-6">
      <ul className="rounded-card border-border bg-card divide-border divide-y border">
        {documents.map((document) => (
          <li key={document.key}>
            <a
              href={document.href}
              target="_blank"
              rel="noopener noreferrer"
              className="hover:bg-muted/60 flex items-start gap-3 p-4 transition-colors"
            >
              <FileTextIcon
                aria-hidden="true"
                className="text-primary mt-0.5 size-5 shrink-0"
              />
              <span className="min-w-0">
                <span className="block text-sm font-medium">
                  {document.title}
                </span>
                <span className="text-muted-foreground block text-xs">
                  {document.summary}
                </span>
              </span>
            </a>
          </li>
        ))}
      </ul>

      <form onSubmit={accept} noValidate className="space-y-4">
        <ConsentCheckbox
          id="gate-accept"
          audience={partner ? 'partner' : 'customer'}
          checked={accepted}
          onChange={(event) => setAccepted(event.target.checked)}
          error={error}
        />
        <Button
          type="submit"
          disabled={pending}
          className="rounded-pill h-12 w-full text-base"
        >
          {pending ? (
            <LoaderCircleIcon aria-hidden="true" className="animate-spin" />
          ) : null}
          Aceptar y continuar
        </Button>
      </form>

      <form action="/auth/sign-out" method="post">
        <Button
          type="submit"
          variant="ghost"
          className="rounded-pill text-muted-foreground w-full"
        >
          No acepto, cerrar sesión
        </Button>
      </form>
    </div>
  )
}
