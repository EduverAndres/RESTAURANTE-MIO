import {
  Building2Icon,
  CalendarCheckIcon,
  CheckIcon,
  MegaphoneIcon,
  type LucideIcon,
} from 'lucide-react'
import { Reveal } from '@/components/motion/reveal'
import { APP_NAME } from '@/lib/env'
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
const FEATURES: readonly Feature[] = [
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
  {
    id: 'destacados',
    icon: MegaphoneIcon,
    eyebrow: 'Publicidad opcional',
    title: 'Destacados patrocinados',
    text: 'Cuando quieras más visibilidad, apareces primero donde los clientes eligen.',
    points: [
      'En la página principal, en tu categoría o en la búsqueda.',
      'Pagas por día, solo los días que corre tu campaña.',
      'Siempre se muestra marcado como "Patrocinado".',
    ],
  },
]

export function MerchantFeatures() {
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
          {FEATURES.map(({ id, icon: Icon, eyebrow, title, text, points }) => (
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
