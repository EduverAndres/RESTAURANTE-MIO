import { describe, expect, it } from 'vitest'
import {
  corporateCheckoutIssue,
  type CorporateCheckoutOption,
} from '@/lib/companies/checkout'

const option: CorporateCheckoutOption = {
  companyName: 'Constructora del Caribe',
  available: 100_000,
  perOrderLimit: 60_000,
  maxTipPct: 10,
  blocked: null,
}
const order = { total: 50_000, subtotal: 45_000, tip: 0 }

describe('corporateCheckoutIssue', () => {
  it('is null when the company can pay', () => {
    expect(corporateCheckoutIssue(option, order)).toBeNull()
  })

  it('says first why the company itself cannot pay', () => {
    expect(
      corporateCheckoutIssue(
        { ...option, blocked: 'En revisión' },
        { ...order, total: 1_000_000 },
      ),
    ).toBe('En revisión')
  })

  it('names the per-order cap', () => {
    expect(corporateCheckoutIssue(option, { ...order, total: 60_001 })).toMatch(
      /tope por pedido de \$\s?60\.000/,
    )
  })

  it('names the tip limit, or says there is none', () => {
    expect(corporateCheckoutIssue(option, { ...order, tip: 5_000 })).toMatch(
      /hasta del 10 %/,
    )
    expect(
      corporateCheckoutIssue({ ...option, maxTipPct: 0 }, { ...order, tip: 1 }),
    ).toMatch(/no cubre propina/)
  })

  it('names what is left', () => {
    expect(
      corporateCheckoutIssue(
        { ...option, available: 40_000, perOrderLimit: null },
        order,
      ),
    ).toMatch(/disponible: \$\s?40\.000/)
  })
})
