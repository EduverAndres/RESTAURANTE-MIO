import { describe, expect, it } from 'vitest'
import {
  bogotaToday,
  courierBlockReason,
  expiringDocuments,
  isCourierActive,
  missingForApproval,
  statusAfterEdit,
  type CourierProfileFacts,
} from '@/lib/couriers/profile'

const TODAY = '2026-11-23'

function profile(
  overrides: Partial<CourierProfileFacts> = {},
): CourierProfileFacts {
  return {
    status: 'approved',
    vehicle_type: 'motorcycle',
    plate: 'ABC12D',
    document_number: '1045678901',
    city: 'Barranquilla',
    license_expires_on: '2027-05-01',
    soat_expires_on: '2027-01-15',
    ...overrides,
  }
}

describe('isCourierActive', () => {
  it('opens the pool to an approved courier with valid documents', () => {
    expect(isCourierActive(profile(), TODAY)).toBe(true)
  })

  it('keeps it closed without a profile, in review or suspended', () => {
    expect(isCourierActive(null, TODAY)).toBe(false)
    expect(isCourierActive(profile({ status: 'pending' }), TODAY)).toBe(false)
    expect(isCourierActive(profile({ status: 'suspended' }), TODAY)).toBe(false)
  })

  it('closes it on its own when the SOAT or the licence expires', () => {
    expect(
      isCourierActive(profile({ soat_expires_on: '2026-11-22' }), TODAY),
    ).toBe(false)
    expect(
      isCourierActive(profile({ license_expires_on: '2026-11-01' }), TODAY),
    ).toBe(false)
  })

  it('still counts a document valid through today', () => {
    expect(isCourierActive(profile({ soat_expires_on: TODAY }), TODAY)).toBe(
      true,
    )
  })

  it('asks nothing of a bicycle or a courier on foot', () => {
    for (const vehicle_type of ['bicycle', 'on_foot'] as const) {
      expect(
        isCourierActive(
          profile({
            vehicle_type,
            plate: null,
            license_expires_on: null,
            soat_expires_on: null,
          }),
          TODAY,
        ),
      ).toBe(true)
    }
  })
})

describe('missingForApproval', () => {
  it('lists what a motorised courier still has to send', () => {
    expect(
      missingForApproval({
        vehicle_type: 'motorcycle',
        plate: null,
        document_number: '1045678901',
        city: 'Barranquilla',
        license_expires_on: null,
        soat_expires_on: '2027-01-15',
      }),
    ).toEqual(['plate', 'license_expires_on'])
  })

  it('needs only identity and city on a bicycle', () => {
    expect(
      missingForApproval({
        vehicle_type: 'bicycle',
        plate: null,
        document_number: null,
        city: null,
        license_expires_on: null,
        soat_expires_on: null,
      }),
    ).toEqual(['document_number', 'city'])
  })

  it('is empty for a complete profile', () => {
    expect(missingForApproval(profile())).toEqual([])
  })
})

describe('statusAfterEdit', () => {
  it('starts every new profile in review', () => {
    expect(statusAfterEdit(null, profile())).toBe('pending')
  })

  it('keeps the approval when the courier only renews papers', () => {
    expect(statusAfterEdit(profile(), profile())).toBe('approved')
  })

  it('sends a changed vehicle, plate or document back to review', () => {
    expect(statusAfterEdit(profile(), profile({ vehicle_type: 'car' }))).toBe(
      'pending',
    )
    expect(statusAfterEdit(profile(), profile({ plate: 'XYZ123' }))).toBe(
      'pending',
    )
    expect(
      statusAfterEdit(profile(), profile({ document_number: '999' })),
    ).toBe('pending')
  })

  it('never lifts a suspension', () => {
    expect(statusAfterEdit(profile({ status: 'suspended' }), profile())).toBe(
      'suspended',
    )
  })
})

describe('expiringDocuments', () => {
  it('flags what expired and what expires soon', () => {
    expect(
      expiringDocuments(
        profile({
          license_expires_on: '2026-11-20',
          soat_expires_on: '2026-12-01',
        }),
        TODAY,
      ),
    ).toEqual([
      { document: 'license', expiresOn: '2026-11-20', expired: true },
      { document: 'soat', expiresOn: '2026-12-01', expired: false },
    ])
  })

  it('stays quiet far from the dates and for non-motorised couriers', () => {
    expect(expiringDocuments(profile(), TODAY)).toEqual([])
    expect(
      expiringDocuments(
        profile({ vehicle_type: 'bicycle', soat_expires_on: '2026-11-01' }),
        TODAY,
      ),
    ).toEqual([])
  })
})

describe('bogotaToday', () => {
  it('uses the Bogotá date, five hours behind UTC', () => {
    expect(bogotaToday(new Date('2026-11-24T04:59:00.000Z'))).toBe('2026-11-23')
    expect(bogotaToday(new Date('2026-11-24T05:00:00.000Z'))).toBe('2026-11-24')
  })
})

describe('courierBlockReason', () => {
  it('is null when the pool is open', () => {
    expect(courierBlockReason(profile(), TODAY)).toBeNull()
  })

  it('tells each closed state what to do', () => {
    expect(courierBlockReason(null, TODAY)).toMatch(/Completa tu perfil/)
    expect(courierBlockReason(profile({ status: 'pending' }), TODAY)).toMatch(
      /en revisión/,
    )
    expect(courierBlockReason(profile({ status: 'suspended' }), TODAY)).toMatch(
      /suspendida/,
    )
    expect(
      courierBlockReason(profile({ soat_expires_on: '2026-01-01' }), TODAY),
    ).toMatch(/vencido/)
  })
})
