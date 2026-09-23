import { ArrowRightIcon } from 'lucide-react'
import Link from 'next/link'
import { FadeIn } from '@/components/motion/fade-in'
import { Button } from '@/components/ui/button'

const STEPS = [
  {
    title: 'Dos toques',
    text: 'Dirección y pago guardados desde tu primera compra.',
  },
  {
    title: 'En vivo',
    text: 'Sigue tu pedido estado por estado y habla con el restaurante.',
  },
  {
    title: 'El precio de la carta es el precio',
    text: 'Sin recargos escondidos: pagás lo que dice el menú, más el envío y la propina que elijas.',
  },
]

/**
 * The three promises that used to share the top of the page with the search
 * box. They are still worth saying — just not before someone has had the
 * chance to look for dinner.
 */
export function HowItWorks() {
  return (
    <section
      aria-labelledby="como-funciona-title"
      className="border-border/60 bg-secondary/40 border-t"
    >
      <div className="container-page py-section">
        <FadeIn inView className="space-y-8">
          <div className="max-w-2xl space-y-2">
            <h2
              id="como-funciona-title"
              className="text-h2 font-display font-semibold"
            >
              Cómo funciona
            </h2>
            <p className="text-muted-foreground text-pretty">
              Sin apps que instalar ni cuentas a medias: el restaurante recibe
              tu pedido al instante y tú lo ves avanzar.
            </p>
          </div>

          <ol className="gap-card grid sm:grid-cols-3">
            {STEPS.map((step, index) => (
              <li
                key={step.title}
                className="rounded-card bg-card shadow-1 p-card space-y-2"
              >
                <span className="rounded-control bg-primary/10 font-display text-primary-on-tint flex size-10 items-center justify-center text-lg font-semibold">
                  {index + 1}
                </span>
                <span className="font-display block text-xl font-semibold">
                  {step.title}
                </span>
                <span className="text-muted-foreground block text-sm">
                  {step.text}
                </span>
              </li>
            ))}
          </ol>

          <Button asChild size="lg" variant="outline" className="rounded-pill">
            <Link href="/register?role=merchant">
              Tengo un restaurante
              <ArrowRightIcon aria-hidden="true" />
            </Link>
          </Button>
        </FadeIn>
      </div>
    </section>
  )
}
