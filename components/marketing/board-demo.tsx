import { BellIcon, CalendarCheckIcon } from 'lucide-react'
import { cn } from '@/lib/utils'

/**
 * The merchant panel, drawn: an order crosses the kitchen board while a table
 * reservation goes from "Por confirmar" to "Confirmada". CSS only.
 *
 * A picture of the product, not of a business: no store name, no price, no
 * customer. The order cards are skeletons with a type label; the reservation
 * times are there because that is what the reservations list shows.
 *
 * - Server component; every movement is a `board-demo-*` animation in
 *   app/globals.css, declared only when motion is allowed.
 * - The markup is the last frame (order in "Listos", reservation confirmed),
 *   so that is what reduced motion shows.
 * - Decorative (`aria-hidden`), described for screen readers in the caption.
 *
 * `--board-gap` is both the grid gap and the mover's step, so the moving
 * card lands exactly on each column.
 */

const COLUMNS = [
  { title: 'Nuevos', cards: ['Para recoger'] },
  { title: 'En cocina', cards: ['Mesa 4', 'Domicilio'] },
  { title: 'Listos', cards: ['Mesa 2'] },
] as const

const RESERVATIONS = [
  { time: '19:30', party: '2 personas', animated: false },
  { time: '20:00', party: '4 personas', animated: true },
  { time: '21:00', party: '6 personas', animated: false },
] as const

function OrderCard({
  label,
  className,
}: {
  label: string
  className?: string
}) {
  return (
    <div
      className={cn(
        'bg-background shadow-1 space-y-2 rounded-xl p-2.5',
        className,
      )}
    >
      <span className="text-muted-foreground block truncate text-[11px] font-medium">
        {label}
      </span>
      <span className="bg-muted block h-1.5 w-4/5 rounded-full" />
      <span className="bg-muted block h-1.5 w-1/2 rounded-full" />
    </div>
  )
}

function ConfirmedBadge({ className }: { className?: string }) {
  return (
    <span
      className={cn(
        'rounded-pill bg-success/12 text-success-on-tint inline-flex px-2 py-0.5 text-[11px] font-semibold whitespace-nowrap',
        className,
      )}
    >
      Confirmada
    </span>
  )
}

export function BoardDemo({ className }: { className?: string }) {
  return (
    <figure className={cn('relative w-full', className)}>
      <div
        aria-hidden="true"
        className="rounded-card bg-card shadow-3 space-y-4 p-4 sm:p-5"
        style={{ '--board-gap': '0.5rem' } as React.CSSProperties}
      >
        <div className="flex items-center justify-between gap-3">
          <span className="font-display text-lg font-semibold">
            Pedidos de hoy
          </span>
          <span className="flex items-center gap-2">
            <span className="rounded-pill bg-success/12 text-success-on-tint inline-flex items-center gap-1.5 px-2 py-0.5 text-[11px] font-semibold">
              <span className="bg-success size-1.5 rounded-full" />
              En vivo
            </span>
            <span className="bg-secondary relative grid size-8 place-items-center rounded-full">
              <BellIcon className="size-4" />
              <span className="board-demo-ping bg-primary ring-card absolute top-1 right-1 size-2.5 rounded-full opacity-0 ring-2" />
            </span>
          </span>
        </div>

        <div className="grid grid-cols-3 gap-[var(--board-gap)]">
          {COLUMNS.map((column) => (
            <span
              key={column.title}
              className="text-muted-foreground truncate text-xs font-semibold"
            >
              {column.title}
            </span>
          ))}

          {/* The lane the new order travels along, across all columns. */}
          <div className="relative col-span-3 h-[4.25rem]">
            <div className="board-demo-mover absolute inset-y-0 left-0 w-[calc((100%-2*var(--board-gap))/3)]">
              <OrderCard
                label="Pedido nuevo"
                className="ring-primary/40 h-full ring-2"
              />
            </div>
          </div>

          {COLUMNS.map((column) => (
            <div key={column.title} className="space-y-[var(--board-gap)]">
              {column.cards.map((card) => (
                <OrderCard key={card} label={card} />
              ))}
            </div>
          ))}
        </div>

        <div className="bg-secondary/60 space-y-2.5 rounded-xl p-3">
          <span className="flex items-center gap-2 text-sm font-semibold">
            <CalendarCheckIcon className="text-primary-on-tint size-4" />
            Reservas de hoy
          </span>
          <ul className="space-y-2">
            {RESERVATIONS.map((reservation) => (
              <li
                key={reservation.time}
                className="bg-background flex items-center justify-between gap-2 rounded-lg px-2.5 py-2 text-xs"
              >
                <span className="min-w-0 truncate">
                  <span className="font-semibold tabular-nums">
                    {reservation.time}
                  </span>
                  <span className="text-muted-foreground">
                    {' '}
                    · {reservation.party}
                  </span>
                </span>
                {reservation.animated ? (
                  <span className="grid justify-items-end">
                    <span className="board-demo-pending rounded-pill bg-accent/25 text-foreground inline-flex px-2 py-0.5 text-[11px] font-semibold whitespace-nowrap opacity-0 [grid-area:1/1]">
                      Por confirmar
                    </span>
                    <ConfirmedBadge className="board-demo-confirmed [grid-area:1/1]" />
                  </span>
                ) : (
                  <ConfirmedBadge />
                )}
              </li>
            ))}
          </ul>
        </div>
      </div>
      <figcaption className="sr-only">
        Ilustración del panel del negocio: un pedido nuevo pasa de Nuevos a En
        cocina y a Listos, y una reserva de mesa pasa de Por confirmar a
        Confirmada.
      </figcaption>
    </figure>
  )
}
