import { CheckIcon, HouseIcon, KeyRoundIcon, StoreIcon } from 'lucide-react'
import { cn } from '@/lib/utils'

/**
 * A phone showing an order move from Recibido to Entregado, in CSS only.
 *
 * It is a drawing of the tracking screen, not a screenshot of an order: no
 * store name, no price, no time that a visitor could mistake for a promise.
 * One loop lasts `--demo-loop` (12 s): the steps light up one by one, the
 * route draws itself on the map and the courier follows it to the door.
 *
 * - Server component. Every bit of movement is a CSS animation declared in
 *   app/globals.css (`order-demo-*`), so there is nothing to hydrate.
 * - The markup is the last frame. With reduced motion — the system's or the
 *   app's — no animation is declared and the order simply reads "Entregado",
 *   route drawn, courier at the door.
 * - Decorative: the drawing is `aria-hidden` and the figure carries a short
 *   description for screen readers instead.
 *
 * The map is a 280×160 drawing. The route's corners are mirrored in the
 * `order-demo-courier` keyframes; move one and move the other.
 */

const STEPS = [
  { label: 'Recibido', hint: 'El negocio ya tiene tu pedido' },
  { label: 'Preparando', hint: 'Está en la cocina' },
  { label: 'En camino', hint: 'Lo sigues en el mapa' },
  { label: 'Entregado', hint: 'Con tu código de entrega' },
] as const

const ROUTE = 'M36 124 V84 H132 V44 H222'

export function LiveOrderDemo({ className }: { className?: string }) {
  return (
    <figure className={cn('relative mx-auto w-full max-w-[19rem]', className)}>
      <div aria-hidden="true" className="relative">
        {/* Soft light behind the phone, from the brand colour. */}
        <div className="bg-primary/15 absolute inset-x-4 top-12 bottom-16 rounded-full blur-3xl" />

        <div className="motion-safe:animate-float relative">
          <div className="bg-card ring-border shadow-3 rounded-[2.75rem] p-2.5 ring-1">
            <div className="bg-background flex flex-col gap-4 overflow-hidden rounded-[2.25rem] px-4 pt-3 pb-5">
              <div className="bg-foreground/80 mx-auto h-5 w-24 rounded-full" />

              <div className="space-y-2">
                <div className="flex items-center justify-between gap-2">
                  <span className="text-muted-foreground text-xs font-medium">
                    Tu pedido
                  </span>
                  <span className="rounded-pill bg-success/12 text-success-on-tint inline-flex items-center gap-1.5 px-2 py-0.5 text-[11px] font-semibold">
                    <span className="bg-success size-1.5 rounded-full" />
                    En vivo
                  </span>
                </div>
                <p className="font-display grid text-2xl font-semibold">
                  {STEPS.map((step, index) => (
                    <span
                      key={step.label}
                      className={cn(
                        `order-demo-label-${index + 1}`,
                        '[grid-area:1/1]',
                        index < STEPS.length - 1 && 'opacity-0',
                      )}
                    >
                      {step.label}
                    </span>
                  ))}
                </p>
                <div className="bg-muted rounded-pill h-1.5 overflow-hidden">
                  <div className="order-demo-progress bg-primary rounded-pill h-full" />
                </div>
              </div>

              <div className="bg-secondary relative aspect-[7/4] overflow-hidden rounded-2xl">
                <svg
                  viewBox="0 0 280 160"
                  className="absolute inset-0 size-full"
                  fill="none"
                >
                  <g
                    className="stroke-card"
                    strokeWidth="9"
                    strokeLinecap="round"
                  >
                    <path d="M-10 124 H290" />
                    <path d="M-10 84 H290" />
                    <path d="M-10 44 H290" />
                    <path d="M36 -10 V170" />
                    <path d="M132 -10 V170" />
                    <path d="M222 -10 V170" />
                  </g>
                  <rect
                    x="152"
                    y="96"
                    width="52"
                    height="18"
                    rx="5"
                    className="fill-success/20"
                  />
                  <rect
                    x="56"
                    y="54"
                    width="58"
                    height="20"
                    rx="5"
                    className="fill-primary/10"
                  />
                  {/* The whole route, faint, so the line has somewhere to go. */}
                  <path
                    d={ROUTE}
                    className="stroke-primary/30"
                    strokeWidth="3.5"
                    strokeDasharray="2 7"
                    strokeLinecap="round"
                    strokeLinejoin="round"
                  />
                  <path
                    d={ROUTE}
                    pathLength={1}
                    strokeDasharray="1"
                    strokeDashoffset="0"
                    className="order-demo-route stroke-primary"
                    strokeWidth="4"
                    strokeLinecap="round"
                    strokeLinejoin="round"
                  />
                  <g
                    className="order-demo-courier"
                    transform="translate(222 44)"
                  >
                    <circle r="10" className="fill-primary/20" />
                    <circle
                      r="6"
                      className="fill-primary stroke-card"
                      strokeWidth="2.5"
                    />
                  </g>
                </svg>

                {/* Markers are HTML so they can use the icon set; their
                    positions are the drawing's coordinates as percentages. */}
                <span className="absolute top-[77.5%] left-[12.86%] -translate-x-1/2 -translate-y-1/2">
                  <span className="order-demo-cooking bg-primary absolute inset-0 rounded-full opacity-0" />
                  <span className="bg-card text-primary-on-tint shadow-2 relative grid size-8 place-items-center rounded-full">
                    <StoreIcon className="size-4" />
                  </span>
                </span>
                <span className="absolute top-[27.5%] left-[88%] -translate-x-1/2 -translate-y-1/2">
                  <span className="bg-primary text-primary-foreground shadow-2 grid size-8 place-items-center rounded-full">
                    <HouseIcon className="size-4" />
                  </span>
                </span>
              </div>

              <ol className="space-y-2.5">
                {STEPS.map((step, index) => (
                  <li
                    key={step.label}
                    className={cn(
                      'flex items-center gap-3',
                      index > 0 && `order-demo-row-${index + 1}`,
                    )}
                  >
                    <span className="border-primary/30 relative grid size-6 shrink-0 place-items-center rounded-full border-2">
                      <span className="order-demo-mark bg-primary text-primary-foreground absolute -inset-0.5 grid place-items-center rounded-full">
                        <CheckIcon className="size-3.5" strokeWidth={3} />
                      </span>
                    </span>
                    <span className="min-w-0 leading-tight">
                      <span className="block text-sm font-semibold">
                        {step.label}
                      </span>
                      <span className="text-muted-foreground block truncate text-xs">
                        {step.hint}
                      </span>
                    </span>
                  </li>
                ))}
              </ol>

              <div className="bg-secondary/70 flex items-center gap-2 rounded-xl px-3 py-2 text-xs">
                <KeyRoundIcon className="text-primary-on-tint size-4" />
                <span className="text-muted-foreground">
                  Se entrega con tu código
                </span>
              </div>
            </div>
          </div>
        </div>
      </div>
      <figcaption className="sr-only">
        Ilustración del seguimiento en vivo: un pedido pasa de Recibido a
        Preparando, En camino y Entregado, mientras el domiciliario recorre la
        ruta del negocio a tu casa en el mapa.
      </figcaption>
    </figure>
  )
}
