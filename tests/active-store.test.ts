import { describe, expect, it } from 'vitest'
import {
  ACTIVE_STORE_COOKIE,
  isUuid,
  parseActiveStoreId,
  pickActiveStore,
} from '@/lib/dashboard/active-store'

const A = { id: '11111111-1111-4111-8111-111111111111', name: 'A' }
const B = { id: '22222222-2222-4222-8222-222222222222', name: 'B' }

describe('active store helpers', () => {
  it('uses a stable cookie name', () => {
    expect(ACTIVE_STORE_COOKIE).toBe('tienda_active_store')
  })

  it('validates uuids', () => {
    expect(isUuid(A.id)).toBe(true)
    expect(isUuid('not-a-uuid')).toBe(false)
    expect(isUuid('')).toBe(false)
  })

  it('parses the cookie value only when it is a uuid', () => {
    expect(parseActiveStoreId(A.id)).toBe(A.id)
    expect(parseActiveStoreId(A.id.toUpperCase())).toBe(A.id.toUpperCase())
    expect(parseActiveStoreId(undefined)).toBeNull()
    expect(parseActiveStoreId('')).toBeNull()
    expect(parseActiveStoreId('garbage; drop table')).toBeNull()
  })

  it('picks the requested store when it belongs to the list', () => {
    expect(pickActiveStore([A, B], B.id)).toBe(B)
  })

  it('falls back to the first store when the cookie is missing or stale', () => {
    expect(pickActiveStore([A, B], null)).toBe(A)
    expect(
      pickActiveStore([A, B], '33333333-3333-4333-8333-333333333333'),
    ).toBe(A)
  })

  it('returns null when the owner has no stores', () => {
    expect(pickActiveStore([], A.id)).toBeNull()
    expect(pickActiveStore([], null)).toBeNull()
  })
})
