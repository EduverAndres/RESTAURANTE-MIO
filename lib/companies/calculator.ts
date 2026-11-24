/**
 * What a company's food orders could cost a month, and the credit line that
 * would cover them, from the company's own numbers. Pure, whole pesos.
 *
 * Shown on /empresas as an estimate, never as a quote: the credit line is
 * whatever the Cerquita team approves. The suggestion covers the month that
 * is running plus the statement waiting to be paid during the payment terms
 * (statements are monthly and due `termsDays` after they are issued), rounded
 * up to the next $100.000.
 */

/** 52 weeks over 12 months. */
export const WEEKS_PER_MONTH = 52 / 12

interface Range {
  min: number
  max: number
  step: number
}

export const COMPANY_ESTIMATE_RANGES = {
  employees: { min: 1, max: 500, step: 1 },
  ordersPerWeek: { min: 1, max: 10, step: 1 },
  averageTicket: { min: 10_000, max: 80_000, step: 1_000 },
} as const satisfies Record<string, Range>

export interface CompanyEstimateInput {
  employees: number
  /** Orders each person places a week. */
  ordersPerWeek: number
  /** Average order total, in COP, delivery and tip included. */
  averageTicket: number
  /** Payment terms the company would ask for. */
  termsDays: number
}

export const COMPANY_ESTIMATE_DEFAULTS: CompanyEstimateInput = {
  employees: 15,
  ordersPerWeek: 2,
  averageTicket: 28_000,
  termsDays: 30,
}

export interface CompanyEstimate {
  ordersPerMonth: number
  /** Monthly budget per person that would cover their orders. */
  perEmployee: number
  monthly: number
  suggestedCredit: number
}

const CREDIT_STEP = 100_000

function clamp(value: number, range: Range): number {
  if (!Number.isFinite(value)) return range.min
  return Math.min(range.max, Math.max(range.min, Math.round(value)))
}

export function estimateCompanyBudget(
  input: CompanyEstimateInput,
): CompanyEstimate {
  const ranges = COMPANY_ESTIMATE_RANGES
  const employees = clamp(input.employees, ranges.employees)
  const ordersPerWeek = clamp(input.ordersPerWeek, ranges.ordersPerWeek)
  const ticket = clamp(input.averageTicket, ranges.averageTicket)
  const terms = Math.max(0, Math.round(input.termsDays))

  // Multiply before dividing by 12 so whole inputs stay exact.
  const monthly = Math.round((employees * ordersPerWeek * 52 * ticket) / 12)
  const coverage = (monthly * (30 + terms)) / 30
  return {
    ordersPerMonth: Math.round((employees * ordersPerWeek * 52) / 12),
    perEmployee: Math.round((ordersPerWeek * 52 * ticket) / 12),
    monthly,
    suggestedCredit: Math.ceil(coverage / CREDIT_STEP) * CREDIT_STEP,
  }
}
