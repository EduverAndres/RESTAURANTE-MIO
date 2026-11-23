import { describe, expect, it } from 'vitest'
import { audienceCtaFor } from '@/lib/marketing/audience-cta'

describe('audienceCtaFor', () => {
  it('sends restaurant owners to the register form as merchants', () => {
    expect(audienceCtaFor('/para-restaurantes')).toMatchObject({
      label: 'Crear mi tienda',
      href: '/register?role=merchant',
    })
  })

  it('sends couriers to the register form as couriers', () => {
    expect(audienceCtaFor('/repartidores')).toMatchObject({
      label: 'Quiero repartir',
      href: '/register?role=courier',
    })
  })

  it('sends companies to the company sign-up', () => {
    expect(audienceCtaFor('/empresas')).toMatchObject({
      label: 'Crear cuenta de empresa',
      href: '/empresa/registro',
    })
  })

  it('matches nested pages of a landing but not a lookalike prefix', () => {
    expect(audienceCtaFor('/repartidores/preguntas')?.href).toBe(
      '/register?role=courier',
    )
    expect(audienceCtaFor('/repartidores-extra')).toBeNull()
  })

  it('has nothing to offer elsewhere', () => {
    expect(audienceCtaFor('/')).toBeNull()
    expect(audienceCtaFor(null)).toBeNull()
  })

  it('never loses the role on a sign-up link', () => {
    for (const path of ['/para-restaurantes', '/repartidores']) {
      expect(audienceCtaFor(path)?.href).toMatch(/\?role=(merchant|courier)$/)
    }
  })
})
