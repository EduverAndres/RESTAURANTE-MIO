import { describe, expect, it } from 'vitest'
import {
  COMPANY_ESTIMATE_DEFAULTS,
  COMPANY_ESTIMATE_RANGES,
  WEEKS_PER_MONTH,
  estimateCompanyBudget,
} from '@/lib/companies/calculator'

describe('estimateCompanyBudget', () => {
  it('multiplies people, orders a week and ticket over an average month', () => {
    const result = estimateCompanyBudget({
      employees: 10,
      ordersPerWeek: 3,
      averageTicket: 25_000,
      termsDays: 30,
    })
    // 3 × 52/12 = 13 orders a month each.
    expect(result.ordersPerMonth).toBe(130)
    expect(result.perEmployee).toBe(325_000)
    expect(result.monthly).toBe(3_250_000)
  })

  it('suggests a credit line that covers the month plus the payment window', () => {
    const base = {
      employees: 10,
      ordersPerWeek: 3,
      averageTicket: 25_000,
    }
    // One month running + the statement waiting to be paid, rounded up to
    // the next $100.000.
    expect(
      estimateCompanyBudget({ ...base, termsDays: 30 }).suggestedCredit,
    ).toBe(6_500_000)
    expect(
      estimateCompanyBudget({ ...base, termsDays: 15 }).suggestedCredit,
    ).toBe(4_900_000)
  })

  it('stays in whole pesos and whole orders', () => {
    const result = estimateCompanyBudget({
      employees: 7,
      ordersPerWeek: 1,
      averageTicket: 17_500,
      termsDays: 45,
    })
    expect(Number.isInteger(result.ordersPerMonth)).toBe(true)
    expect(Number.isInteger(result.monthly)).toBe(true)
    expect(result.suggestedCredit % 100_000).toBe(0)
  })

  it('clamps inputs to the sliders’ ranges', () => {
    const result = estimateCompanyBudget({
      employees: 100_000,
      ordersPerWeek: -3,
      averageTicket: 25_000,
      termsDays: 30,
    })
    expect(result.ordersPerMonth).toBe(
      Math.round(
        COMPANY_ESTIMATE_RANGES.employees.max *
          COMPANY_ESTIMATE_RANGES.ordersPerWeek.min *
          WEEKS_PER_MONTH,
      ),
    )
  })

  it('starts from a sensible example', () => {
    expect(
      estimateCompanyBudget(COMPANY_ESTIMATE_DEFAULTS).monthly,
    ).toBeGreaterThan(0)
  })
})
