import { HeartIcon } from 'lucide-react'
import Link from 'next/link'
import { Button } from '@/components/ui/button'
import { APP_NAME } from '@/lib/env'

/**
 * The one invitation a guest at a table gets, shown on their order page once
 * the order is in: an account keeps this place in their favourites, so next
 * time they can order from it without scanning anything.
 *
 * It promises only what an account does today. It does not claim to move
 * this guest order into the new account, because nothing does that.
 */
export function GuestCaptureCard({
  storeName,
  storeSlug,
}: {
  storeName: string
  storeSlug: string
}) {
  const next = encodeURIComponent(`/t/${storeSlug}`)

  return (
    <section
      aria-labelledby="guest-capture-title"
      className="rounded-card border-border bg-card shadow-soft space-y-3 border p-5"
    >
      <div className="flex items-start gap-3">
        <span className="rounded-control bg-primary/10 text-primary-on-tint grid size-10 shrink-0 place-items-center">
          <HeartIcon aria-hidden="true" className="size-5" />
        </span>
        <div className="space-y-1">
          <h2
            id="guest-capture-title"
            className="font-display text-xl font-semibold"
          >
            ¿Te gustó {storeName}?
          </h2>
          <p className="text-muted-foreground text-sm text-pretty">
            Crea tu cuenta en {APP_NAME} para guardarlo en tus favoritos y
            volver a pedirle cuando quieras, sin escanear nada.
          </p>
        </div>
      </div>
      <div className="flex flex-wrap items-center gap-3">
        <Button asChild className="rounded-pill">
          <Link href={`/register?next=${next}`}>Crear mi cuenta</Link>
        </Button>
        <Link
          href={`/login?next=${next}`}
          className="text-muted-foreground hover:text-foreground text-sm underline-offset-4 hover:underline"
        >
          Ya tengo cuenta
        </Link>
      </div>
    </section>
  )
}
