// @vitest-environment node
import { describe, expect, it, vi } from 'vitest'
import {
  INVITATION_MAX_DAYS,
  invitationState,
  invitationUrl,
  invitationWhatsAppUrl,
  isInvitationTokenShape,
} from '@/lib/companies/invitations'
import {
  hashInvitationToken,
  newInvitationToken,
} from '@/lib/companies/invitations.server'

// Hoisted above the imports by vitest.
vi.mock('server-only', () => ({}))

const NOW = new Date('2026-11-23T15:00:00Z')
const open = {
  revoked_at: null,
  expires_at: '2026-11-30T15:00:00Z',
  uses: 0,
  max_uses: 5,
}

describe('invitationState', () => {
  it('is active while open, with uses left and not revoked', () => {
    expect(invitationState(open, NOW)).toBe('active')
  })

  it('revoked wins over everything else', () => {
    expect(
      invitationState(
        { ...open, revoked_at: '2026-11-22T00:00:00Z', uses: 5 },
        NOW,
      ),
    ).toBe('revoked')
  })

  it('expires at the stated instant', () => {
    expect(
      invitationState({ ...open, expires_at: NOW.toISOString() }, NOW),
    ).toBe('expired')
  })

  it('runs out of uses', () => {
    expect(invitationState({ ...open, uses: 5 }, NOW)).toBe('used_up')
  })

  it('never stays open more than 30 days (also checked in SQL)', () => {
    expect(INVITATION_MAX_DAYS).toBe(30)
  })
})

describe('links', () => {
  it('builds the join URL without a double slash', () => {
    expect(invitationUrl('https://cerquita.co/', 'abc')).toBe(
      'https://cerquita.co/empresa/unirse/abc',
    )
  })

  it('shares by WhatsApp with the link in the text', () => {
    const url = invitationWhatsAppUrl(
      'Constructora del Caribe',
      'https://cerquita.co/empresa/unirse/abc',
    )
    expect(url.startsWith('https://wa.me/?text=')).toBe(true)
    const text = decodeURIComponent(url.split('text=')[1])
    expect(text).toContain('Constructora del Caribe')
    expect(text).toContain('https://cerquita.co/empresa/unirse/abc')
  })
})

describe('tokens', () => {
  it('creates unguessable base64url tokens and keeps only their hash', () => {
    const a = newInvitationToken()
    const b = newInvitationToken()
    expect(a.token).not.toBe(b.token)
    expect(isInvitationTokenShape(a.token)).toBe(true)
    expect(a.hash).toMatch(/^[0-9a-f]{64}$/)
    expect(a.hash).toBe(hashInvitationToken(a.token))
  })

  it('hashes like the database: sha256 of the UTF-8 text, hex', () => {
    // select encode(sha256(convert_to('abc', 'UTF8')), 'hex');
    expect(hashInvitationToken('abc')).toBe(
      'ba7816bf8f01cfea414140de5dae2223b00361a396177a9cb410ff61f20015ad',
    )
  })

  it('rejects anything that is not a token', () => {
    expect(isInvitationTokenShape('short')).toBe(false)
    expect(isInvitationTokenShape('a'.repeat(31))).toBe(false)
    expect(isInvitationTokenShape(`${'a'.repeat(31)}/`)).toBe(false)
    expect(isInvitationTokenShape('a'.repeat(32))).toBe(true)
  })
})
