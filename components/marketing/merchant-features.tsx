import {
  Building2Icon,
  CalendarCheckIcon,
  CheckIcon,
  MegaphoneIcon,
  type LucideIcon,
} from 'lucide-react'
import { Reveal } from '@/components/motion/reveal'
import { daysLabel, type AdPlacementSettings } from '@/lib/ads/pricing'
import { SPONSORED_LABEL, type AdPlacement } from '@/lib/ads/vocabulary'
import { APP_NAME } from '@/lib/env'
import { formatCOP } from '@/lib/format'
import { ONLINE_PAYMENT_PCT, PLAN_LABELS } from '@/lib/plans'

interface Feature {
  id: string
  icon: LucideIcon
  eyebrow: string
  title: string
  text: string
  points: readonly string[]
}

/**
 * Three ways to sell more that a delivery app does not give a restaurant:
 * table reservations, company orders and sponsored placements. Each card says
 * what it costs or which plan includes it, with the names and the online
 * rate read from lib/plans.ts, and a sponsored placement is described as
 * what it is — paid, by the day, and labelled "Patrocinado" wherever it
 * shows. The ids are anchors the footer links to.
 */
const BASE_FEATURES: readonly Feature[] = [
  {
    id: 'reservas',
    icon: CalendarCheckIcon,
    eyebrow: `Planes ${PLAN_LABELS.mediano} y ${PLAN_LABELS.vip}`,
    title: 'Reservas de mesa',
    text: 'Tus clientes reservan desde tu tienda y tú decides: confirmas desde el panel, en tiempo real.',
    points: [
      'El cliente elige día, hora y cuántas personas van.',
      'Confirmas o rechazas con un toque; el cliente recibe el aviso.',
      'Marcas quién llegó y quién no, y ves su historial contigo.',
    ],
  },
  {
    id: 'empresas',
    icon: Building2Icon,
    eyebrow: 'Cuentas corporativas',
    title: 'Pedidos de empresas',
    text: 'Equipos con cuenta corporativa piden para su gente, en tu tienda, sin pagar en la puerta.',
    points: [
      'El pedido llega marcado como de empresa, con los datos para facturar.',
      'Facturas al NIT de la empresa.',
      `${APP_NAME} te lo liquida como un pago en línea (comisión del plan más ${ONLINE_PAYMENT_PCT} %).`,
    ],
  },
]

const WHERE: Record<AdPlacement, string> = {
  home_featured: 'en la página principal',
  category_top: 'primero en tu categoría',
  search_top: 'primero en la búsqueda',
}

/**
 * The sponsored-placement card, with the prices and rules as they are in the
 * price list today. Without them (the read failed) it describes the product
 * and quotes nothing: a stale price in an ad is a false one.
 */
function sponsoredFeature(placements: readonly AdPlacementSettings[]): Feature {
  const base = {
    id: 'destacados',
    icon: MegaphoneIcon,
    title: 'Destacados patrocinados',
    text: `Cuando quieras más visibilidad, apareces primero donde los clientes eligen. Lo pides desde tu panel y el equipo de ${APP_NAME} lo aprueba.`,
  }
  const labelled = `Siempre se muestra marcado como «${SPONSORED_LABEL}», con cupos limitados por día.`
  if (placements.length === 0) {
    return {
      ...base,
      eyebrow: 'Publicidad opcional',
      points: [
        'En la página principal, en tu categoría o en la búsqueda.',
        'Pagas por día, solo los días que tu anuncio está al aire, descontados de tu liquidación.',
        labelled,
      ],
    }
  }
  const cheapest = Math.min(...placements.map((row) => row.daily_price))
  const where = placements.map(
    (row) => `${WHERE[row.placement]} (${formatCOP(row.daily_price)} al día)`,
  )
  const minDays = Math.min(...placements.map((row) => row.min_days))
  const maxDays = Math.max(...placements.map((row) => row.max_days))
  return {
    ...base,
    eyebrow: `Publicidad opcional · desde ${formatCOP(cheapest)} al día`,
    points: [
      `Apareces ${new Intl.ListFormat('es', { type: 'disjunction' }).format(where)}.`,
      `Campañas de ${minDays} a ${daysLabel(maxDays)}. Pagas solo los días que tu anuncio está al aire, descontados de tu liquidación; los días en pausa no se cobran.`,
      labelled,
    ],
  }
}

export function MerchantFeatures({
  adPlacements = [],
}: {
  /** The price list (lib/marketing/public-data.ts#fetchAdPlacements). */
  adPlacements?: readonly AdPlacementSettings[]
}) {
  const features = [...BASE_FEATURES, sponsoredFeature(adPlacements)]
  return (
    <section
      aria-labelledby="vende-mas-title"
      className="border-border/60 border-t"
    >
      <div className="container-page py-section space-y-10">
        <Reveal className="max-w-2xl space-y-3">
          <p className="text-primary-on-tint text-xs font-semibold tracking-wide uppercase">
            Vende más
          </p>
          <h2
            id="vende-mas-title"
            className="text-h1 font-display font-semibold"
          >
            Más formas de llenar tu cocina
          </h2>
          <p className="text-muted-foreground text-lead text-pretty">
            Además de domicilios, para recoger y mesa: reservas, empresas y
            visibilidad cuando la necesites.
          </p>
        </Reveal>

        <ul className="gap-card grid lg:grid-cols-3">
          {features.map(({ id, icon: Icon, eyebrow, title, text, points }) => (
            <Reveal
              as="li"
              key={id}
              id={id}
              className="rounded-card bg-card shadow-1 p-card flex scroll-mt-24 flex-col gap-4"
            >
              <span className="rounded-control bg-primary/10 text-primary-on-tint grid size-12 place-items-center">
                <Icon aria-hidden="true" className="size-6" />
              </span>
              <div className="space-y-1.5">
                <p className="text-primary-on-tint text-xs font-semibold tracking-wide uppercase">
                  {eyebrow}
                </p>
                <h3 className="text-h3 font-display font-semibold">{title}</h3>
                <p className="text-muted-foreground text-sm text-pretty">
                  {text}
                </p>
              </div>
              <ul className="space-y-2 text-sm">
                {points.map((point) => (
                  <li key={point} className="flex items-start gap-2">
                    <CheckIcon
                      aria-hidden="true"
                      className="text-success-on-tint mt-0.5 size-4 shrink-0"
                    />
                    <span>{point}</span>
                  </li>
                ))}
              </ul>
            </Reveal>
          ))}
        </ul>
      </div>
    </section>
  )
}
