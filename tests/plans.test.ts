import { describe, expect, it } from 'vitest'
import {
  billableDays,
  bogotaDate,
  effectivePlan,
  isFounderActive,
  planFeeForPeriod,
  planHas,
  platformFeePct,
} from '@/lib/plans'

const store = {
  commission_pct: 6,
  online_payment_pct: 5,
  founder_until: null as string | null,
}

describe('platformFeePct', () => {
  const at = '2026-11-05T15:00:00.000Z'

  it('charges nothing on a table order paid at the table', () => {
    expect(
      platformFeePct(
        { type: 'table', payment_method: 'cash', created_at: at },
        store,
      ),
    ).toBe(0)
  })

  it('charges only the online share on a table order paid online', () => {
    expect(
      platformFeePct(
        { type: 'table', payment_method: 'wompi', created_at: at },
        store,
      ),
    ).toBe(5)
  })

  it('charges the base commission on delivery and pickup paid in cash', () => {
    for (const type of ['delivery', 'pickup'] as const) {
      expect(
        platformFeePct({ type, payment_method: 'cash', created_at: at }, store),
      ).toBe(6)
    }
  })

  it('adds the online share for every non-cash method', () => {
    for (const method of ['wompi', 'mercadopago', 'mock'] as const) {
      expect(
        platformFeePct(
          { type: 'delivery', payment_method: method, created_at: at },
          store,
        ),
      ).toBe(11)
    }
  })

  it('waives the base commission, not the online share, for a founder', () => {
    const founder = { ...store, founder_until: '2026-12-31' }
    expect(
      platformFeePct(
        { type: 'delivery', payment_method: 'cash', created_at: at },
        founder,
      ),
    ).toBe(0)
    expect(
      platformFeePct(
        { type: 'delivery', payment_method: 'wompi', created_at: at },
        founder,
      ),
    ).toBe(5)
  })

  it('reads the founder date on the Bogotá calendar', () => {
    const founder = { ...store, founder_until: '2026-12-31' }
    // 23:30 in Bogotá on Dec 31 is already Jan 1 in UTC: still a founder.
    expect(
      platformFeePct(
        {
          type: 'pickup',
          payment_method: 'cash',
          created_at: '2027-01-01T04:30:00.000Z',
        },
        founder,
      ),
    ).toBe(0)
    // 00:30 in Bogotá on Jan 1: the period is over.
    expect(
      platformFeePct(
        {
          type: 'pickup',
          payment_method: 'cash',
          created_at: '2027-01-01T05:30:00.000Z',
        },
        founder,
      ),
    ).toBe(6)
  })
})

describe('bogotaDate / isFounderActive', () => {
  it('shifts UTC back five hours', () => {
    expect(bogotaDate(new Date('2027-01-01T04:59:00.000Z'))).toBe('2026-12-31')
    expect(bogotaDate(new Date('2027-01-01T05:00:00.000Z'))).toBe('2027-01-01')
  })

  it('is inclusive of the last founder day and false without a date', () => {
    const lastDay = new Date('2026-12-31T20:00:00.000Z')
    expect(isFounderActive('2026-12-31', lastDay)).toBe(true)
    expect(isFounderActive('2026-12-30', lastDay)).toBe(false)
    expect(isFounderActive(null, lastDay)).toBe(false)
  })
})

describe('effectivePlan / planHas', () => {
  const now = new Date('2026-11-05T15:00:00.000Z')

  it('treats an active founder as VIP whatever plan is stored', () => {
    expect(
      effectivePlan({ plan: 'normal', founder_until: '2027-02-03' }, now),
    ).toBe('vip')
    expect(
      effectivePlan({ plan: 'normal', founder_until: '2026-11-01' }, now),
    ).toBe('normal')
    expect(effectivePlan({ plan: 'mediano', founder_until: null }, now)).toBe(
      'mediano',
    )
  })

  it('opens features plan by plan', () => {
    expect(planHas('normal', 'presets')).toBe(true)
    expect(planHas('normal', 'theme-editor')).toBe(false)
    expect(planHas('mediano', 'theme-editor')).toBe(true)
    expect(planHas('mediano', 'full-metrics')).toBe(true)
    expect(planHas('mediano', 'custom-css')).toBe(false)
    expect(planHas('mediano', 'featured-home')).toBe(false)
    for (const feature of [
      'presets',
      'theme-editor',
      'full-metrics',
      'custom-css',
      'hero-video',
      'featured-home',
      'priority-support',
    ] as const) {
      expect(planHas('vip', feature), feature).toBe(true)
    }
  })
})

describe('billableDays / planFeeForPeriod', () => {
  const week = { periodStart: '2026-11-02', periodEnd: '2026-11-08' }

  it('bills every day of the period when there is no founder date', () => {
    expect(billableDays(week, null)).toBe(7)
    expect(planFeeForPeriod(129_900, week, null)).toBe(30_310)
  })

  it('bills only the days after the founder period', () => {
    expect(billableDays(week, '2026-11-05')).toBe(3)
    expect(planFeeForPeriod(49_900, week, '2026-11-05')).toBe(4_990)
  })

  it('bills nothing while the whole period is covered', () => {
    expect(billableDays(week, '2026-11-08')).toBe(0)
    expect(billableDays(week, '2027-02-01')).toBe(0)
    expect(planFeeForPeriod(129_900, week, '2027-02-01')).toBe(0)
  })

  it('charges a full month for a thirty-day period and nothing on Normal', () => {
    const month = { periodStart: '2026-11-01', periodEnd: '2026-11-30' }
    expect(planFeeForPeriod(49_900, month, null)).toBe(49_900)
    expect(planFeeForPeriod(0, month, null)).toBe(0)
  })
})
