// What each plan includes, in the words the merchant reads. Shared by the
// owner landing's price table and the dashboard's plan card so the two can
// never list different things. Pure.
import { formatCOP } from '@/lib/format'
import { PLAN_IDS, planHas, type PlanFeature, type PlanId } from '@/lib/plans'

export interface PlanRow {
  label: string
  /** null: included in every plan. */
  feature: PlanFeature | null
}

export const PLAN_ROWS: readonly PlanRow[] = [
  {
    label: 'Tienda, carta, QR de mesa, panel y tablero de cocina',
    feature: null,
  },
  { label: '10 temas listos, logo y portada', feature: 'presets' },
  {
    label: 'Colores, tipografías, carta y secciones a tu gusto',
    feature: 'theme-editor',
  },
  { label: 'Estadísticas completas', feature: 'full-metrics' },
  { label: 'CSS propio y video en la portada', feature: 'custom-css' },
  { label: 'Destacado en la página principal', feature: 'featured-home' },
  { label: 'Soporte prioritario por WhatsApp', feature: 'priority-support' },
]

export function planIncludes(plan: PlanId, row: PlanRow): boolean {
  return row.feature === null || planHas(plan, row.feature)
}

/** "Gratis" or "$49.900 al mes". */
export function monthlyFeeLabel(fee: number): string {
  return fee <= 0 ? 'Gratis' : `${formatCOP(fee)} al mes`
}

/** The next plan up, for the upgrade line; null on VIP. */
export function nextPlan(plan: PlanId): PlanId | null {
  const index = PLAN_IDS.indexOf(plan)
  return PLAN_IDS[index + 1] ?? null
}
