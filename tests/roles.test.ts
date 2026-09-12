import { describe, expect, it } from 'vitest'
import { canAccess, getRoleHome, requiredRolesFor } from '@/lib/auth/roles'

describe('getRoleHome', () => {
  it('maps each role to its landing route', () => {
    expect(getRoleHome('customer')).toBe('/')
    expect(getRoleHome('merchant')).toBe('/dashboard')
    expect(getRoleHome('courier')).toBe('/courier')
    expect(getRoleHome('admin')).toBe('/admin')
  })

  it('falls back to the public home when the role is unknown', () => {
    expect(getRoleHome(null)).toBe('/')
    expect(getRoleHome(undefined)).toBe('/')
    expect(getRoleHome('something-else')).toBe('/')
  })
})

describe('requiredRolesFor', () => {
  it('returns null for public routes', () => {
    expect(requiredRolesFor('/')).toBeNull()
    expect(requiredRolesFor('/login')).toBeNull()
    expect(requiredRolesFor('/t/la-parrilla-del-norte')).toBeNull()
  })

  it('returns the roles allowed on protected prefixes', () => {
    expect(requiredRolesFor('/dashboard')).toEqual(['merchant', 'admin'])
    expect(requiredRolesFor('/dashboard/orders/123')).toEqual([
      'merchant',
      'admin',
    ])
    expect(requiredRolesFor('/courier')).toEqual(['courier', 'admin'])
    expect(requiredRolesFor('/admin/stores')).toEqual(['admin'])
  })

  it('returns an empty list for routes that only require authentication', () => {
    expect(requiredRolesFor('/account')).toEqual([])
    expect(requiredRolesFor('/account/reset-password')).toEqual([])
  })

  it('does not match prefixes that merely share characters', () => {
    expect(requiredRolesFor('/dashboards')).toBeNull()
    expect(requiredRolesFor('/administration')).toBeNull()
    expect(requiredRolesFor('/accounting')).toBeNull()
  })
})

describe('canAccess', () => {
  it('allows anyone on public routes', () => {
    expect(canAccess('/', null)).toEqual({ allowed: true })
    expect(canAccess('/t/slug', 'customer')).toEqual({ allowed: true })
  })

  it('requires authentication on protected routes', () => {
    expect(canAccess('/account', null)).toEqual({
      allowed: false,
      reason: 'unauthenticated',
    })
    expect(canAccess('/dashboard', null)).toEqual({
      allowed: false,
      reason: 'unauthenticated',
    })
  })

  it('allows any authenticated user on account routes', () => {
    expect(canAccess('/account', 'customer')).toEqual({ allowed: true })
    expect(canAccess('/account', 'courier')).toEqual({ allowed: true })
  })

  it('enforces role on dashboard, courier and admin routes', () => {
    expect(canAccess('/dashboard', 'merchant')).toEqual({ allowed: true })
    expect(canAccess('/dashboard', 'admin')).toEqual({ allowed: true })
    expect(canAccess('/dashboard', 'customer')).toEqual({
      allowed: false,
      reason: 'forbidden',
    })
    expect(canAccess('/courier/route', 'courier')).toEqual({ allowed: true })
    expect(canAccess('/courier', 'merchant')).toEqual({
      allowed: false,
      reason: 'forbidden',
    })
    expect(canAccess('/admin', 'admin')).toEqual({ allowed: true })
    expect(canAccess('/admin', 'merchant')).toEqual({
      allowed: false,
      reason: 'forbidden',
    })
  })

  it('treats an authenticated user with an unrecognised role as a customer', () => {
    expect(canAccess('/account', 'unknown')).toEqual({ allowed: true })
    expect(canAccess('/dashboard', 'unknown')).toEqual({
      allowed: false,
      reason: 'forbidden',
    })
  })
})
