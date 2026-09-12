import Link from 'next/link'
import { Wordmark } from '@/components/layout/site-header'
import { Button } from '@/components/ui/button'
import { EmptyState } from '@/components/ui/empty-state'

export default function NotFound() {
  return (
    <div className="flex min-h-dvh flex-col">
      <header className="container-page flex h-16 items-center">
        <Wordmark />
      </header>
      <main className="container-page flex flex-1 items-center justify-center py-16">
        <div className="w-full max-w-xl space-y-6 text-center">
          <p className="font-display font-display-soft text-primary/80 text-8xl font-semibold">
            404
          </p>
          <EmptyState
            title="Esta página no está en el menú"
            description="La dirección que abriste no existe o fue movida. Volvamos a un lugar con comida."
            action={
              <Button asChild className="rounded-pill">
                <Link href="/">Ir al inicio</Link>
              </Button>
            }
          />
        </div>
      </main>
    </div>
  )
}
