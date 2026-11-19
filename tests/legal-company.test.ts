import { describe, expect, it, vi } from 'vitest'
import { buildCompany, NIT_IN_PROGRESS } from '@/lib/legal/company'

vi.mock('@/lib/env', () => ({ APP_NAME: 'Cerquita' }))

const FULL = {
  NEXT_PUBLIC_LEGAL_NAME: 'Eduver Gutierrez',
  NEXT_PUBLIC_LEGAL_NIT: '1234567890-1',
  NEXT_PUBLIC_LEGAL_ADDRESS: 'Calle 1 # 2-3',
  NEXT_PUBLIC_LEGAL_EMAIL: 'contacto@ejemplo.com',
  NEXT_PUBLIC_LEGAL_PHONE: '+57 300 000 0000',
}

describe('buildCompany', () => {
  it('is complete only when every identifying field is set', () => {
    const { company, missing } = buildCompany(FULL, 'Cerquita')
    expect(missing).toEqual([])
    expect(Object.values(company).join(' ')).not.toMatch(/PENDIENTE/)
  })

  it('shows "En trámite" for a missing NIT but still counts it missing', () => {
    const { company, missing } = buildCompany(
      { ...FULL, NEXT_PUBLIC_LEGAL_NIT: '' },
      'Cerquita',
    )
    expect(company.nit).toBe(NIT_IN_PROGRESS)
    expect(missing).toEqual(['nit'])
    // The wording cannot hide the gap: no PENDIENTE text, yet incomplete.
    expect(Object.values(company).join(' ')).not.toMatch(/PENDIENTE/)
  })

  it('marks every other missing field with a visible placeholder', () => {
    const { company, missing } = buildCompany({}, 'Cerquita')
    expect(missing).toEqual(['legalName', 'nit', 'address', 'email', 'phone'])
    expect(company.legalName).toMatch(/PENDIENTE/)
    expect(company.address).toMatch(/PENDIENTE/)
    expect(company.email).toMatch(/PENDIENTE/)
    expect(company.phone).toMatch(/PENDIENTE/)
  })

  it('uses the contact email for data protection unless one is given', () => {
    expect(buildCompany(FULL, 'Cerquita').company.privacyEmail).toBe(
      'contacto@ejemplo.com',
    )
    expect(
      buildCompany(
        { ...FULL, NEXT_PUBLIC_PRIVACY_EMAIL: 'datos@ejemplo.com' },
        'Cerquita',
      ).company.privacyEmail,
    ).toBe('datos@ejemplo.com')
  })

  it('appends the city to a street address, once', () => {
    expect(buildCompany(FULL, 'Cerquita').company.address).toBe(
      'Calle 1 # 2-3, Barranquilla, Atlántico, Colombia',
    )
    expect(
      buildCompany(
        {
          ...FULL,
          NEXT_PUBLIC_LEGAL_ADDRESS: 'Calle 1 # 2-3, Barranquilla, Atlántico',
        },
        'Cerquita',
      ).company.address,
    ).toBe('Calle 1 # 2-3, Barranquilla, Atlántico')
  })

  it('trims whitespace-only values to missing', () => {
    expect(
      buildCompany({ ...FULL, NEXT_PUBLIC_LEGAL_PHONE: '   ' }, 'Cerquita')
        .missing,
    ).toEqual(['phone'])
  })
})
