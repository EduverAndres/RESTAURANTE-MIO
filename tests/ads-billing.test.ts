import { describe, expect, it } from 'vitest'
import {
  adBillableDays,
  adChargedToDate,
  adDisplayStatus,
  adFeeForPeriod,
  adsFeesByStore,
  isAdRunning,
  lastChargeableDay,
  type AdPauseSpan,
  type BillableCampaign,
} from '@/lib/ads/billing'
import { AD_STATUSES, type AdStatus } from '@/lib/ads/vocabulary'
import { AD_BILLABLE_DAYS_RULE, AD_RUNNING_RULE } from '@/lib/payouts/sql'
import { addDays } from '@/lib/store/hours'

// The same campaigns as the SQL scenario run against generate_payouts v4 in
// the local database (see the phase report): the numbers must agree.
const B1: BillableCampaign = {
  status: 'active',
  starts_on: '2026-08-03',
  ends_on: '2026-08-16',
  ended_at: null,
  daily_price: 15000,
}
const B1_PAUSES: AdPauseSpan[] = [
  {
    paused_at: '2026-08-05T10:00:00-05:00',
    resumed_at: '2026-08-08T09:00:00-05:00',
  },
]
const B2: BillableCampaign = {
  status: 'ended',
  starts_on: '2026-08-01',
  ends_on: '2026-08-31',
  ended_at: '2026-08-12T15:00:00-05:00',
  daily_price: 8000,
}
const B5: BillableCampaign = {
  status: 'paused',
  starts_on: '2026-08-03',
  ends_on: '2026-08-16',
  ended_at: null,
  daily_price: 6000,
}
const B5_PAUSES: AdPauseSpan[] = [
  { paused_at: '2026-08-06T20:00:00-05:00', resumed_at: null },
]
const P1 = { periodStart: '2026-08-03', periodEnd: '2026-08-09' }
const P2 = { periodStart: '2026-08-10', periodEnd: '2026-08-16' }

describe('adBillableDays', () => {
  it('skips the paused days: paused on the 5th, lifted on the 8th', () => {
    // 3, 4, 8 and 9: the 5th (paused that day), 6th and 7th are free; the
    // 8th is charged because the campaign ran again that day.
    expect(adBillableDays(B1, B1_PAUSES, P1)).toBe(4)
    expect(adBillableDays(B1, B1_PAUSES, P2)).toBe(7)
  })

  it('stops the day before an early end', () => {
    expect(lastChargeableDay(B2)).toBe('2026-08-11')
    expect(adBillableDays(B2, [], P1)).toBe(7)
    expect(adBillableDays(B2, [], P2)).toBe(2)
  })

  it('charges nothing after a pause that was never lifted', () => {
    expect(adBillableDays(B5, B5_PAUSES, P1)).toBe(3)
    expect(adBillableDays(B5, B5_PAUSES, P2)).toBe(0)
  })

  it('reads every instant on the Bogotá calendar, not UTC', () => {
    // 23:30 in Bogotá is already the next day in UTC.
    const lateNight: AdPauseSpan[] = [
      { paused_at: '2026-08-04T23:30:00-05:00', resumed_at: null },
    ]
    expect(adBillableDays(B1, lateNight, P1)).toBe(1) // only the 3rd
    expect(
      lastChargeableDay({
        ends_on: '2026-08-31',
        ended_at: '2026-08-13T04:00:00Z',
      }),
    ).toBe('2026-08-11')
  })

  it('makes a pause lifted the same day free and costless', () => {
    const blip: AdPauseSpan[] = [
      {
        paused_at: '2026-08-04T09:00:00-05:00',
        resumed_at: '2026-08-04T12:00:00-05:00',
      },
    ]
    expect(adBillableDays(B1, blip, P1)).toBe(7)
  })

  it('is zero outside the campaign dates', () => {
    expect(
      adBillableDays(B1, [], {
        periodStart: '2026-07-01',
        periodEnd: '2026-07-31',
      }),
    ).toBe(0)
    expect(
      adBillableDays(B1, [], {
        periodStart: '2026-09-01',
        periodEnd: '2026-09-07',
      }),
    ).toBe(0)
  })
})

describe('adFeeForPeriod and adsFeesByStore', () => {
  it('charges only approved campaigns, at their frozen price', () => {
    expect(adFeeForPeriod(B1, B1_PAUSES, P1)).toBe(60000)
    for (const status of ['requested', 'rejected', 'cancelled'] as const) {
      expect(adFeeForPeriod({ ...B1, status }, [], P1), status).toBe(0)
    }
  })

  it('sums per store, like the ads_fees CTE, and drops stores that owe nothing', () => {
    const fees = adsFeesByStore(
      [
        { ...B1, id: 'b1', store_id: 'arepa' },
        { ...B2, id: 'b2', store_id: 'arepa' },
        { ...B5, id: 'b5', store_id: 'verde' },
        { ...B1, status: 'rejected', id: 'b3', store_id: 'arepa' },
      ],
      new Map([
        ['b1', B1_PAUSES],
        ['b5', B5_PAUSES],
      ]),
      P1,
    )
    expect(fees).toEqual([
      { store_id: 'arepa', ads_fee: 60000 + 56000 },
      { store_id: 'verde', ads_fee: 18000 },
    ])
    expect(
      adsFeesByStore(
        [
          { ...B1, id: 'b1', store_id: 'arepa' },
          { ...B2, id: 'b2', store_id: 'arepa' },
          { ...B5, id: 'b5', store_id: 'verde' },
        ],
        new Map([
          ['b1', B1_PAUSES],
          ['b5', B5_PAUSES],
        ]),
        P2,
      ),
    ).toEqual([{ store_id: 'arepa', ads_fee: 105000 + 16000 }])
  })

  it('reports what ran so far, never more than the quote', () => {
    expect(adChargedToDate(B1, B1_PAUSES, '2026-08-09')).toBe(60000)
    expect(adChargedToDate(B1, B1_PAUSES, '2026-08-02')).toBe(0)
    expect(adChargedToDate(B1, [], '2026-12-31')).toBe(14 * 15000)
  })
})

describe('isAdRunning and adDisplayStatus', () => {
  const campaign = { starts_on: '2026-11-23', ends_on: '2026-11-25' }

  it('runs an active campaign inside its dates, both ends included', () => {
    expect(isAdRunning({ ...campaign, status: 'active' }, '2026-11-23')).toBe(
      true,
    )
    expect(isAdRunning({ ...campaign, status: 'active' }, '2026-11-25')).toBe(
      true,
    )
    expect(isAdRunning({ ...campaign, status: 'active' }, '2026-11-26')).toBe(
      false,
    )
    expect(isAdRunning({ ...campaign, status: 'paused' }, '2026-11-24')).toBe(
      false,
    )
  })

  it('reads an approved campaign as scheduled, on the air or over', () => {
    expect(
      adDisplayStatus({ ...campaign, status: 'active' }, '2026-11-22'),
    ).toBe('scheduled')
    expect(
      adDisplayStatus({ ...campaign, status: 'active' }, '2026-11-24'),
    ).toBe('active')
    expect(
      adDisplayStatus({ ...campaign, status: 'active' }, '2026-11-26'),
    ).toBe('finished')
    expect(
      adDisplayStatus({ ...campaign, status: 'paused' }, '2026-11-26'),
    ).toBe('finished')
    expect(
      adDisplayStatus({ ...campaign, status: 'requested' }, '2026-11-26'),
    ).toBe('requested')
  })
})

// ---------------------------------------------------------------------------
// Drift: the SQL charges days with a formula, the app counts them one by one.
// ---------------------------------------------------------------------------
const D = (n: number) => addDays('2026-08-01', n)
const at = (n: number, time: string) => `${D(n)}T${time}:00-05:00`

const PAUSE_PATTERNS: AdPauseSpan[][] = [
  [],
  [{ paused_at: at(2, '10:00'), resumed_at: null }],
  [{ paused_at: at(4, '10:00'), resumed_at: at(6, '09:00') }],
  [{ paused_at: at(4, '10:00'), resumed_at: at(4, '18:00') }],
  [{ paused_at: at(3, '23:30'), resumed_at: at(5, '00:15') }],
  [
    { paused_at: at(2, '22:00'), resumed_at: at(3, '07:00') },
    { paused_at: at(5, '12:00'), resumed_at: null },
  ],
  [
    { paused_at: at(1, '03:00'), resumed_at: at(2, '03:00') },
    { paused_at: at(2, '04:00'), resumed_at: at(7, '23:00') },
  ],
  [
    { paused_at: at(0, '08:00'), resumed_at: at(1, '08:00') },
    { paused_at: at(3, '08:00'), resumed_at: at(3, '09:00') },
    { paused_at: at(8, '08:00'), resumed_at: at(9, '20:00') },
  ],
]

describe('the SQL mirror of the billable days', () => {
  it('agrees with adBillableDays on every start, end, early end, pause and period', () => {
    let cases = 0
    for (const starts_on of [D(1), D(3)]) {
      for (const ends_on of [D(3), D(5), D(8)]) {
        for (const ended_at of [
          null,
          at(0, '10:00'),
          at(4, '15:00'),
          at(9, '08:00'),
        ]) {
          for (const pauses of PAUSE_PATTERNS) {
            for (const [from, to] of [
              [0, 6],
              [2, 4],
              [5, 9],
              [7, 9],
              [0, 9],
            ]) {
              const campaign = { starts_on, ends_on, ended_at }
              const period = { periodStart: D(from), periodEnd: D(to) }
              expect(
                AD_BILLABLE_DAYS_RULE.matches(campaign, pauses, period),
                JSON.stringify({ campaign, pauses, period }),
              ).toBe(adBillableDays(campaign, pauses, period))
              cases += 1
            }
          }
        }
      }
    }
    expect(cases).toBe(2 * 3 * 4 * PAUSE_PATTERNS.length * 5)
  })
})

describe('the SQL mirror of the running rule', () => {
  it('agrees with isAdRunning on every status and date position', () => {
    for (const status of AD_STATUSES as readonly AdStatus[]) {
      for (const today of [
        '2026-11-22',
        '2026-11-23',
        '2026-11-24',
        '2026-11-26',
      ]) {
        const campaign = {
          status,
          starts_on: '2026-11-23',
          ends_on: '2026-11-24',
        }
        expect(
          AD_RUNNING_RULE.matches(campaign, today),
          `${status}/${today}`,
        ).toBe(isAdRunning(campaign, today))
      }
    }
  })
})
