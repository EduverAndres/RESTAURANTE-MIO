// @vitest-environment node
import { readFileSync } from 'node:fs'
import { fileURLToPath } from 'node:url'
import { beforeEach, describe, expect, it, vi } from 'vitest'
import {
  adRequestedNotification,
  adStatusNotification,
  companyRegisteredNotification,
  courierSubmittedNotification,
  fromPush,
  payoutNotification,
  storeRegisteredNotification,
} from '@/lib/notifications/messages'
import {
  isInAppPath,
  relativeTimeLabel,
  unreadBadge,
} from '@/lib/notifications/time'
import { NOTIFICATION_KINDS } from '@/lib/notifications/vocabulary'
import { sqlValueList } from '@/lib/refunds/vocabulary'

vi.mock('server-only', () => ({}))

describe('notification messages', () => {
  it('sends admins to the page where they decide', () => {
    expect(
      adRequestedNotification({
        storeName: 'La Parrilla',
        placement: 'la página principal',
        dates: '1 al 7 de dic',
      }),
    ).toMatchObject({ kind: 'ad_requested', url: '/admin/publicidad' })
    expect(companyRegisteredNotification({ companyName: 'Acme' }).url).toBe(
      '/admin/companies',
    )
    expect(
      courierSubmittedNotification({ courierName: 'Jhon', again: false }).url,
    ).toBe('/admin/domiciliarios')
    expect(storeRegisteredNotification({ storeName: 'Sushi' }).url).toBe(
      '/admin/stores',
    )
  })

  it('tells a courier who changed papers apart from a new one', () => {
    expect(
      courierSubmittedNotification({ courierName: 'Jhon', again: true }).title,
    ).toMatch(/actualizó/)
  })

  it('says what a payout means for the merchant', () => {
    expect(
      payoutNotification({
        stage: 'generated',
        periodLabel: '17–23 nov',
        amountLabel: '$ 120.000',
        owes: true,
      }).body,
    ).toMatch(/saldo/)
    expect(
      adStatusNotification({ change: 'paused', placement: 'Inicio' }).body,
    ).toMatch(/no se muestra ni se cobra/)
  })

  it('wraps an existing push without changing its words', () => {
    expect(
      fromPush('reservation_new', {
        title: 'Nueva reserva',
        body: 'Hoy',
        url: '/dashboard/reservas',
        tag: 'new-reservation',
      }),
    ).toEqual({
      kind: 'reservation_new',
      title: 'Nueva reserva',
      body: 'Hoy',
      url: '/dashboard/reservas',
      tag: 'new-reservation',
    })
  })

  it('keeps every title within what the table accepts', () => {
    const samples = [
      adRequestedNotification({
        storeName: 'x'.repeat(80),
        placement: 'p',
        dates: 'd',
      }),
      companyRegisteredNotification({ companyName: 'x'.repeat(150) }),
    ]
    for (const sample of samples) {
      expect(sample.title.length).toBeLessThanOrEqual(120)
      expect(sample.url.startsWith('/')).toBe(true)
    }
  })
})

describe('bell labels', () => {
  const now = Date.parse('2026-11-24T15:00:00Z')
  const ago = (ms: number) => new Date(now - ms).toISOString()

  it('says how long ago, in words that never vary by browser', () => {
    expect(relativeTimeLabel(ago(10_000), now)).toBe('ahora')
    expect(relativeTimeLabel(ago(5 * 60_000), now)).toBe('hace 5 min')
    expect(relativeTimeLabel(ago(3 * 3_600_000), now)).toBe('hace 3 h')
    expect(relativeTimeLabel(ago(30 * 3_600_000), now)).toBe('ayer')
    expect(relativeTimeLabel(ago(4 * 86_400_000), now)).toBe('hace 4 días')
    expect(relativeTimeLabel(ago(30 * 86_400_000), now)).toMatch(/2026/)
  })

  it('treats a clock slightly ahead as now', () => {
    expect(relativeTimeLabel(new Date(now + 5_000).toISOString(), now)).toBe(
      'ahora',
    )
  })

  it('only follows in-app paths', () => {
    expect(isInAppPath('/admin/publicidad')).toBe(true)
    expect(isInAppPath('/')).toBe(true)
    expect(isInAppPath('//evil.example')).toBe(false)
    expect(isInAppPath('https://evil.example')).toBe(false)
  })

  it('caps the badge at one small circle', () => {
    expect(unreadBadge(0)).toBeNull()
    expect(unreadBadge(3)).toBe('3')
    expect(unreadBadge(12)).toBe('9+')
  })
})

// ---------------------------------------------------------------------------
// The migration
// ---------------------------------------------------------------------------
const SQL = readFileSync(
  fileURLToPath(
    new URL(
      '../supabase/migrations/20261125000100_notifications.sql',
      import.meta.url,
    ),
  ),
  'utf8',
).replace(/\r\n/g, '\n')

describe('20261125000100_notifications.sql', () => {
  it('embeds the kinds verbatim', () => {
    const begin = '-- codegen:begin(notification_kinds)'
    const from = SQL.indexOf(begin) + begin.length
    const to = SQL.indexOf('-- codegen:end(notification_kinds)')
    expect(SQL.slice(from, to).trim()).toBe(sqlValueList(NOTIFICATION_KINDS))
  })

  it('lets each person read and mark only their own', () => {
    expect(SQL).toContain(
      'revoke all on public.notifications from anon, authenticated;',
    )
    expect(SQL).toContain(
      'grant select on public.notifications to authenticated;',
    )
    expect(SQL).toContain(
      'grant update (read_at) on public.notifications to authenticated;',
    )
    expect(SQL.match(/create policy "notifications: [^"]+"/g)).toEqual([
      'create policy "notifications: recipient reads own"',
      'create policy "notifications: recipient marks read"',
    ])
    expect(SQL).not.toMatch(/for insert/)
  })

  it('is delivered live through Realtime', () => {
    expect(SQL).toContain(
      'alter publication supabase_realtime add table public.notifications;',
    )
  })

  it('follows the migration conventions', () => {
    expect(SQL).toContain("set lock_timeout = '3s';")
    expect(SQL).toContain('reset lock_timeout;')
    expect(SQL).not.toMatch(/^\s*(begin|commit);/m)
  })
})

// ---------------------------------------------------------------------------
// notify()
// ---------------------------------------------------------------------------
const inserted: unknown[] = []
const pushed: { ids: readonly string[]; tag: string }[] = []
let insertError: { message: string } | null = null

vi.mock('@/lib/push/send', () => ({
  sendPushToUsers: async (ids: readonly string[], payload: { tag: string }) => {
    pushed.push({ ids, tag: payload.tag })
  },
}))

vi.mock('@/lib/supabase/admin', () => ({
  createAdminClient: () => ({
    from(table: string) {
      if (table === 'notifications') {
        return {
          insert: async (rows: unknown[]) => {
            inserted.push(...rows)
            return { error: insertError }
          },
        }
      }
      const rowsFor: Record<string, unknown> = {
        profiles: [{ id: 'admin-1' }, { id: 'admin-2' }],
        stores: { owner_id: 'owner-1' },
        company_members: [{ user_id: 'boss-1' }],
      }
      const chain = {
        select: () => chain,
        eq: () => chain,
        maybeSingle: async () => ({ data: rowsFor[table], error: null }),
        then: (resolve: (value: unknown) => void) =>
          resolve({ data: rowsFor[table], error: null }),
      }
      return chain
    },
  }),
}))

describe('notify', () => {
  const message = adRequestedNotification({
    storeName: 'La Parrilla',
    placement: 'Inicio',
    dates: 'dic',
  })

  beforeEach(() => {
    inserted.length = 0
    pushed.length = 0
    insertError = null
  })

  it('writes one inbox row per admin and pushes to all of them', async () => {
    const { notify } = await import('@/lib/notifications/send')
    await notify({ admins: true }, message)
    expect(inserted).toHaveLength(2)
    expect(inserted[0]).toMatchObject({
      recipient_id: 'admin-1',
      kind: 'ad_requested',
      url: '/admin/publicidad',
    })
    expect(pushed).toEqual([
      { ids: ['admin-1', 'admin-2'], tag: 'ad-requested' },
    ])
  })

  it('finds a store owner and a company’s admins', async () => {
    const { notify } = await import('@/lib/notifications/send')
    await notify({ storeOwner: 'store-1' }, message)
    await notify({ companyAdmins: 'company-1' }, message)
    expect(pushed.map((entry) => entry.ids)).toEqual([['owner-1'], ['boss-1']])
  })

  it('still pushes, and never throws, when the inbox write fails', async () => {
    insertError = { message: 'boom' }
    const { notify } = await import('@/lib/notifications/send')
    await expect(
      notify({ userIds: ['u1', 'u1'] }, message),
    ).resolves.toBeUndefined()
    expect(pushed).toEqual([{ ids: ['u1'], tag: 'ad-requested' }])
  })
})
