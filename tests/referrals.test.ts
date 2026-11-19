import { describe, expect, it } from 'vitest'
import {
  claimMessage,
  keepForLater,
  normalizeReferralCode,
  referralLink,
} from '@/lib/referrals'

describe('normalizeReferralCode', () => {
  it('accepts six letters and digits however they were typed', () => {
    expect(normalizeReferralCode(' ab3-k9q ')).toBe('AB3K9Q')
  })

  it('rejects anything that is not a code', () => {
    expect(normalizeReferralCode('ABC')).toBeNull()
    expect(normalizeReferralCode('ABCDEFG')).toBeNull()
    expect(normalizeReferralCode(null)).toBeNull()
  })
})

describe('referralLink', () => {
  it('points at the home with the code', () => {
    expect(referralLink('https://cerquita.co/', 'AB3K9Q')).toBe(
      'https://cerquita.co/?ref=AB3K9Q',
    )
  })
})

describe('claimMessage / keepForLater', () => {
  it('celebrates a welcome credit and explains a paused programme', () => {
    expect(claimMessage('ok', '$ 5.000')?.text).toContain('$ 5.000')
    expect(claimMessage('budget', '$ 5.000')?.tone).toBe('info')
  })

  it('stays quiet about refusals the customer cannot act on', () => {
    for (const result of [
      'self',
      'already_referred',
      'not_new',
      'invalid_code',
    ] as const) {
      expect(claimMessage(result, '$ 5.000')).toBeNull()
      expect(keepForLater(result)).toBe(false)
    }
  })

  it('keeps the invitation while there is no account yet', () => {
    expect(keepForLater('unauthenticated')).toBe(true)
    expect(keepForLater('failed')).toBe(true)
    expect(keepForLater('ok')).toBe(false)
  })
})
