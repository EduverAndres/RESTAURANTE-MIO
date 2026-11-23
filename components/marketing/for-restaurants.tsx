import {
  ArrowRightIcon,
  PaletteIcon,
  QrCodeIcon,
  WalletIcon,
} from 'lucide-react'
import Link from 'next/link'
import { BoardDemo } from '@/components/marketing/board-demo'
import { Button } from '@/components/ui/button'

/** The owner's sign-up: lands on the register form with the role chosen. */
export const MERCHANT_REGISTER_HREF = '/register?role=merchant'

/**
 * The top of the owner landing: the promise, three proofs and the panel
 * itself, drawn and moving (BoardDemo). The argument with numbers — the
 * savings calculator — has its own section further down.
 *
 * "Ver una tienda de verdad" only appears when there is a real, active store
 * to send the owner to (`demoSlug`, read on the server); a link to a store
 * that only exists in a seed file is a dead end in production.
 */

const PROMISES = [
  {
    icon: QrCodeIcon,
    title: 'El QR en la mesa',
    body: 'El cliente escanea, ve tu carta y pide sin llamar a nadie. Sin cuenta, sin descargar nada. Menos vueltas para el mesero y menos pedidos mal tomados.',
  },
  {
    icon: PaletteIcon,
    title: 'Tu marca, no la nuestra',
    body: 'Colores, tipografías, portada y hasta el orden de la carta. Tu tienda no parece una ficha más de un catálogo: se ve como tu negocio.',
  },
  {
    icon: WalletIcon,
    title: 'Cuentas claras',
    body: 'Lo que te pagan en efectivo es tuyo desde el primer momento. Lo que te pagan en línea te lo transferimos, y en tu panel ves cada venta, la comisión y cada transferencia.',
  },
] as const

export function ForRestaurants({
  standalone = false,
  demoSlug,
}: {
  /** As a page of its own the headline is the h1 and there is no rule above. */
  standalone?: boolean
  /** Slug of a live store to show, or null to hide the link. */
  demoSlug: string | null
}) {
  const Heading = standalone ? 'h1' : 'h2'
  return (
    <section
      id="para-restaurantes"
      aria-labelledby="para-restaurantes-title"
      className={
        standalone
          ? 'brand-mesh'
          : 'border-border/60 bg-card scroll-mt-24 border-t'
      }
    >
      <div className="container-page py-section">
        {/* No entrance animation: the headline is this page's largest paint
            and has to be in the HTML at full opacity. */}
        <div className="grid items-center gap-10 lg:grid-cols-[minmax(0,1fr)_minmax(0,1fr)] lg:gap-14">
          <div className="space-y-8">
            <div className="space-y-3">
              <p className="text-primary-on-tint text-xs font-semibold tracking-wide uppercase">
                Para negocios
              </p>
              <Heading
                id="para-restaurantes-title"
                className="text-h1 font-display font-semibold text-balance"
              >
                Tus clientes ya son tuyos. Tu canal de venta también debería
                serlo.
              </Heading>
              <p className="text-muted-foreground text-lead text-pretty">
                Pedidos a domicilio, para recoger y desde la mesa, reservas y
                pedidos de empresas, con tu propia marca y en un solo panel.
              </p>
            </div>

            <ul className="space-y-5">
              {PROMISES.map(({ icon: Icon, title, body }) => (
                <li key={title} className="flex gap-4">
                  <span className="rounded-control bg-primary/10 text-primary-on-tint flex size-10 shrink-0 items-center justify-center">
                    <Icon aria-hidden="true" className="size-5" />
                  </span>
                  <div className="space-y-1">
                    <h3 className="font-display text-lg font-semibold">
                      {title}
                    </h3>
                    <p className="text-muted-foreground text-sm text-pretty">
                      {body}
                    </p>
                  </div>
                </li>
              ))}
            </ul>

            <div className="flex flex-col gap-3 sm:flex-row">
              <Button
                asChild
                size="lg"
                className="rounded-pill h-12 px-6 text-base"
              >
                <Link href={MERCHANT_REGISTER_HREF}>
                  Crear mi tienda
                  <ArrowRightIcon aria-hidden="true" data-icon="inline-end" />
                </Link>
              </Button>
              {demoSlug ? (
                <Button
                  asChild
                  size="lg"
                  variant="outline"
                  className="rounded-pill h-12 px-6 text-base"
                >
                  <Link href={`/t/${demoSlug}`}>Ver una tienda de verdad</Link>
                </Button>
              ) : null}
            </div>
          </div>

          <BoardDemo className="mx-auto max-w-xl" />
        </div>
      </div>
    </section>
  )
}
