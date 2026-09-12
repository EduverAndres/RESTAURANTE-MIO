import {
  BikeIcon,
  ClockIcon,
  MapPinIcon,
  NavigationIcon,
  PhoneIcon,
  WalletIcon,
} from 'lucide-react'
import { SectionShell } from '@/components/store/sections/section-shell'
import { StoreMap } from '@/components/store/store-map'
import type { StoreSectionProps } from '@/components/store/storefront-context'
import { formatCOP } from '@/lib/format'
import { weeklySchedule } from '@/lib/store/hours'
import { cn } from '@/lib/utils'

/** Google Maps directions, by coordinates when we have them. */
function directionsHref(
  lat: number | null,
  lng: number | null,
  address: string | null,
): string | null {
  if (lat !== null && lng !== null) {
    return `https://www.google.com/maps/dir/?api=1&destination=${lat},${lng}`
  }
  if (address) {
    return `https://www.google.com/maps/dir/?api=1&destination=${encodeURIComponent(address)}`
  }
  return null
}

function Fact({
  icon,
  label,
  value,
}: {
  icon: React.ReactNode
  label: string
  value: string
}) {
  return (
    <div className="rounded-[var(--store-radius)] bg-[var(--store-surface)] p-[var(--store-density-padding)] shadow-[var(--store-card-shadow)] [border:var(--store-card-border)]">
      <dt className="flex items-center gap-1.5 text-xs text-[rgb(var(--store-text-rgb)/0.75)]">
        {icon}
        {label}
      </dt>
      <dd className="mt-1 font-semibold text-[var(--text-lead)] tabular-nums">
        {value}
      </dd>
    </div>
  )
}

/**
 * Address, opening hours and the facts that decide an order. The weekly table
 * highlights today so a visitor answers "are they open right now" without
 * counting rows.
 */
export function InfoSection({ context }: StoreSectionProps) {
  const { store, theme, hours } = context
  const rows = weeklySchedule(store.schedule, new Date())
  const hasCoords = store.lat !== null && store.lng !== null
  const directions = directionsHref(store.lat, store.lng, store.address)
  const showMap = theme.footer.showMap && hasCoords
  const showSchedule = theme.footer.showSchedule

  return (
    <SectionShell id="informacion" title="Información" tone="surface">
      <dl className="mb-8 grid grid-cols-2 gap-3 sm:grid-cols-4">
        <Fact
          icon={<ClockIcon aria-hidden="true" className="size-3.5" />}
          label="Preparación"
          value={`${store.prep_time_min ?? 20} min`}
        />
        <Fact
          icon={<BikeIcon aria-hidden="true" className="size-3.5" />}
          label="Domicilio"
          value={
            Number(store.delivery_fee ?? 0) === 0
              ? 'Gratis'
              : formatCOP(Number(store.delivery_fee))
          }
        />
        <Fact
          icon={<WalletIcon aria-hidden="true" className="size-3.5" />}
          label="Pedido mínimo"
          value={formatCOP(Number(store.min_order ?? 0))}
        />
        <Fact
          icon={<NavigationIcon aria-hidden="true" className="size-3.5" />}
          label="Cobertura"
          value={`${store.delivery_radius_km} km`}
        />
      </dl>

      <div className="gap-inline grid lg:grid-cols-2">
        <div className="space-y-6">
          {store.address ? (
            <div className="space-y-3">
              <h3 className="store-heading text-h3">Dónde estamos</h3>
              <p className="flex items-start gap-2 text-[rgb(var(--store-text-rgb)/0.78)]">
                <MapPinIcon
                  aria-hidden="true"
                  className="mt-1 size-4 shrink-0 text-[var(--store-primary)]"
                />
                {store.address}
              </p>
              <div className="flex flex-wrap gap-2">
                {directions ? (
                  <a
                    href={directions}
                    target="_blank"
                    rel="noopener noreferrer"
                    className="store-btn h-10 px-4 text-sm"
                  >
                    <NavigationIcon aria-hidden="true" className="size-4" />
                    Cómo llegar
                  </a>
                ) : null}
                {store.whatsapp_phone ? (
                  <a
                    href={`tel:${store.whatsapp_phone}`}
                    className="store-btn-outline h-10 px-4 text-sm"
                  >
                    <PhoneIcon aria-hidden="true" className="size-4" />
                    Llamar
                  </a>
                ) : null}
              </div>
            </div>
          ) : null}

          {showSchedule ? (
            <div className="space-y-3">
              <h3 className="store-heading text-h3">Horario</h3>
              {/*
                Not a live region. The open/closed state has exactly one
                announcer on this page — the chip in the hero (see
                components/store/status-chips.tsx) — and it is the same
                `hours.label` string. Two regions reading the same sentence is
                worse than one.
              */}
              <p className="text-sm font-medium text-[var(--store-primary)]">
                {hours.label}
              </p>
              <table className="w-full max-w-sm text-sm">
                <caption className="sr-only">
                  Horario semanal de {store.name}
                </caption>
                <tbody>
                  {rows.map((row) => (
                    <tr
                      key={row.day}
                      className={cn(
                        'border-b border-[rgb(var(--store-text-rgb)/0.08)] last:border-0',
                        row.today &&
                          'bg-[rgb(var(--store-primary-rgb)/0.08)] font-semibold',
                      )}
                    >
                      <th
                        scope="row"
                        className="py-2 pl-2 text-left font-[inherit]"
                      >
                        {row.label}
                        {row.today ? (
                          <span className="sr-only"> (hoy)</span>
                        ) : null}
                      </th>
                      <td className="py-2 pr-2 text-right tabular-nums">
                        {row.hours
                          ? `${row.hours.open} – ${row.hours.close}`
                          : 'Cerrado'}
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          ) : null}
        </div>

        {showMap && store.lat !== null && store.lng !== null ? (
          <StoreMap
            center={{ lat: store.lat, lng: store.lng }}
            label={store.name}
          />
        ) : null}
      </div>

      {theme.footer.text ? (
        <p className="mt-8 text-sm text-pretty text-[rgb(var(--store-text-rgb)/0.75)]">
          {theme.footer.text}
        </p>
      ) : null}
    </SectionShell>
  )
}
