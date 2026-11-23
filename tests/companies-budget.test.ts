import { describe, expect, it } from 'vitest'
import {
  authorizeCorporateCharge,
  availableToSpend,
  creditUsed,
  holdsCorporateCredit,
  isBillableCharge,
  isStatementOverdue,
  memberRemaining,
  tipExceeds,
  type CorporateCompanyFacts,
  type CorporateMemberFacts,
} from '@/lib/companies/budget'
import { CORPORATE_REJECTIONS } from '@/lib/companies/vocabulary'

const company: CorporateCompanyFacts = {
  status: 'active',
  credit_limit: 1_000_000,
  credit_used: 0,
  max_tip_pct: 10,
  overdue: false,
}
const member: CorporateMemberFacts = {
  active: true,
  monthly_budget: 300_000,
  per_order_limit: 80_000,
  spent_this_month: 0,
}
const order = { total: 50_000, subtotal: 44_000, tip: 0 }

describe('authorizeCorporateCharge', () => {
  it('approves a charge inside every limit', () => {
    expect(authorizeCorporateCharge(company, member, order)).toEqual({
      ok: true,
    })
  })

  it('refuses a company that is not active', () => {
    for (const status of ['pending', 'suspended'] as const) {
      expect(
        authorizeCorporateCharge({ ...company, status }, member, order),
      ).toEqual({ ok: false, reason: 'company_inactive' })
    }
  })

  it('refuses a company with an overdue statement', () => {
    expect(
      authorizeCorporateCharge({ ...company, overdue: true }, member, order),
    ).toEqual({ ok: false, reason: 'company_overdue' })
  })

  it('refuses someone who is no longer an active member', () => {
    expect(authorizeCorporateCharge(company, null, order)).toEqual({
      ok: false,
      reason: 'member_inactive',
    })
    expect(
      authorizeCorporateCharge(company, { ...member, active: false }, order),
    ).toEqual({ ok: false, reason: 'member_inactive' })
  })

  it('applies the per-order cap to the total, inclusive', () => {
    expect(
      authorizeCorporateCharge(company, member, { ...order, total: 80_000 }),
    ).toEqual({ ok: true })
    expect(
      authorizeCorporateCharge(company, member, { ...order, total: 80_001 }),
    ).toEqual({ ok: false, reason: 'over_order_limit' })
    expect(
      authorizeCorporateCharge(
        company,
        { ...member, per_order_limit: null },
        { ...order, total: 200_000 },
      ),
    ).toEqual({ ok: true })
  })

  it('caps the tip as a share of the subtotal', () => {
    expect(
      authorizeCorporateCharge(company, member, { ...order, tip: 4_400 }),
    ).toEqual({ ok: true })
    expect(
      authorizeCorporateCharge(company, member, { ...order, tip: 4_401 }),
    ).toEqual({ ok: false, reason: 'tip_too_high' })
    expect(
      authorizeCorporateCharge({ ...company, max_tip_pct: 0 }, member, {
        ...order,
        tip: 1,
      }),
    ).toEqual({ ok: false, reason: 'tip_too_high' })
  })

  it('keeps the member inside their monthly budget', () => {
    expect(
      authorizeCorporateCharge(
        company,
        { ...member, spent_this_month: 250_000 },
        order,
      ),
    ).toEqual({ ok: true })
    expect(
      authorizeCorporateCharge(
        company,
        { ...member, spent_this_month: 250_001 },
        order,
      ),
    ).toEqual({ ok: false, reason: 'over_member_budget' })
    expect(
      authorizeCorporateCharge(
        company,
        { ...member, monthly_budget: null, spent_this_month: 9_000_000 },
        order,
      ),
    ).toEqual({ ok: true })
  })

  it('keeps the company inside its credit line', () => {
    expect(
      authorizeCorporateCharge(
        { ...company, credit_used: 950_000 },
        member,
        order,
      ),
    ).toEqual({ ok: true })
    expect(
      authorizeCorporateCharge(
        { ...company, credit_used: 950_001 },
        member,
        order,
      ),
    ).toEqual({ ok: false, reason: 'over_credit_limit' })
  })

  it('reports the first failing rule, in the order the database checks them', () => {
    // Fail everything, then fix one rule at a time: the reason must walk the
    // list in order.
    let c: CorporateCompanyFacts = {
      ...company,
      status: 'suspended',
      overdue: true,
      credit_used: 2_000_000,
    }
    let m: CorporateMemberFacts | null = {
      ...member,
      active: false,
      spent_this_month: 1_000_000,
    }
    let o = { total: 90_000, subtotal: 10_000, tip: 5_000 }
    const seen: string[] = []
    const fixes = [
      () => (c = { ...c, status: 'active' }),
      () => (c = { ...c, overdue: false }),
      () => (m = { ...m!, active: true }),
      () => (o = { ...o, total: 60_000 }),
      () => (o = { ...o, tip: 0 }),
      () => (m = { ...m!, spent_this_month: 0 }),
      () => (c = { ...c, credit_used: 0 }),
    ]
    for (const fix of fixes) {
      const decision = authorizeCorporateCharge(c, m, o)
      if (!decision.ok) seen.push(decision.reason)
      fix()
    }
    expect(seen).toEqual([...CORPORATE_REJECTIONS])
    expect(authorizeCorporateCharge(c, m, o)).toEqual({ ok: true })
  })
})

describe('credit and budget arithmetic', () => {
  it('credit used is unbilled plus open statements minus pending credits', () => {
    expect(
      creditUsed({
        unbilled: 120_000,
        openStatements: 300_000,
        pendingCredits: 20_000,
      }),
    ).toBe(400_000)
  })

  it('what is left this month, or null without a budget', () => {
    expect(memberRemaining({ ...member, spent_this_month: 100_000 })).toBe(
      200_000,
    )
    expect(memberRemaining({ ...member, spent_this_month: 400_000 })).toBe(0)
    expect(memberRemaining({ ...member, monthly_budget: null })).toBeNull()
  })

  it('available is the tighter of the budget and the credit line', () => {
    expect(availableToSpend(company, member)).toBe(300_000)
    expect(availableToSpend({ ...company, credit_used: 900_000 }, member)).toBe(
      100_000,
    )
    expect(availableToSpend(company, { ...member, monthly_budget: null })).toBe(
      1_000_000,
    )
    expect(
      availableToSpend({ ...company, credit_used: 1_200_000 }, member),
    ).toBe(0)
  })
})

describe('order and statement predicates', () => {
  it('only an authorised, live corporate order holds credit', () => {
    const base = {
      payment_method: 'corporate',
      payment_status: 'paid',
      status: 'accepted',
    } as const
    expect(holdsCorporateCredit(base)).toBe(true)
    expect(holdsCorporateCredit({ ...base, status: 'cancelled' })).toBe(false)
    expect(holdsCorporateCredit({ ...base, payment_status: 'pending' })).toBe(
      false,
    )
    expect(holdsCorporateCredit({ ...base, payment_status: 'refunded' })).toBe(
      false,
    )
    expect(holdsCorporateCredit({ ...base, payment_method: 'wompi' })).toBe(
      false,
    )
  })

  it('bills delivered corporate orders, refunded ones included', () => {
    const base = {
      payment_method: 'corporate',
      payment_status: 'paid',
      status: 'delivered',
    } as const
    expect(isBillableCharge(base)).toBe(true)
    expect(isBillableCharge({ ...base, payment_status: 'refunded' })).toBe(true)
    expect(isBillableCharge({ ...base, status: 'picked_up' })).toBe(false)
    expect(isBillableCharge({ ...base, payment_status: 'failed' })).toBe(false)
  })

  it('a statement is overdue only while it still asks for money', () => {
    const issued = {
      status: 'issued',
      total: 100,
      due_on: '2026-11-20',
    } as const
    expect(isStatementOverdue(issued, '2026-11-21')).toBe(true)
    expect(isStatementOverdue(issued, '2026-11-20')).toBe(false)
    expect(
      isStatementOverdue({ ...issued, status: 'overdue' }, '2026-11-21'),
    ).toBe(true)
    expect(
      isStatementOverdue({ ...issued, status: 'paid' }, '2026-11-21'),
    ).toBe(false)
    expect(
      isStatementOverdue({ ...issued, status: 'void' }, '2026-11-21'),
    ).toBe(false)
    expect(isStatementOverdue({ ...issued, total: 0 }, '2026-11-21')).toBe(
      false,
    )
    expect(isStatementOverdue({ ...issued, total: -500 }, '2026-11-21')).toBe(
      false,
    )
  })

  it('compares the tip with whole-peso arithmetic', () => {
    expect(tipExceeds({ subtotal: 33_333, tip: 3_333 }, 10)).toBe(false)
    expect(tipExceeds({ subtotal: 33_333, tip: 3_334 }, 10)).toBe(true)
    expect(tipExceeds({ subtotal: 0, tip: 0 }, 0)).toBe(false)
  })
})
