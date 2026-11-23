import { describe, expect, it } from 'vitest'
import {
  companyApprovalSchema,
  companyRegisterSchema,
  invitationCreateSchema,
  memberUpdateSchema,
  merchantInvoiceSchema,
  normalizePhone,
  parsePesosInput,
  statementPeriodSchema,
} from '@/lib/validations/companies'

const ID = '0b7c8f5e-2f4a-4c1b-9d5e-3a2b1c0d9e8f'

const company = {
  legalName: 'Constructora del Caribe S.A.S.',
  tradeName: '',
  nit: '900.123.456-8',
  billingEmail: 'facturas@caribe.co',
  billingAddress: 'Calle 77 # 59-35, oficina 902',
  city: 'Barranquilla',
  contactName: 'Santiago Pérez',
  contactPhone: '300 123 4567',
  acceptTerms: true as const,
}

function firstMessage(result: {
  success: boolean
  error?: { issues: { message: string }[] }
}) {
  return result.success ? null : result.error!.issues[0].message
}

describe('companyRegisterSchema', () => {
  it('accepts a company with a valid NIT and check digit', () => {
    expect(companyRegisterSchema.safeParse(company).success).toBe(true)
  })

  it('explains what is wrong with the NIT', () => {
    expect(
      firstMessage(
        companyRegisterSchema.safeParse({ ...company, nit: '900123456' }),
      ),
    ).toMatch(/dígito de verificación/)
    expect(
      firstMessage(
        companyRegisterSchema.safeParse({ ...company, nit: '900123456-7' }),
      ),
    ).toMatch(/no corresponde/)
    expect(
      firstMessage(companyRegisterSchema.safeParse({ ...company, nit: 'abc' })),
    ).toMatch(/900123456-8/)
  })

  it('requires accepting the Términos para Empresas', () => {
    expect(
      firstMessage(
        companyRegisterSchema.safeParse({ ...company, acceptTerms: false }),
      ),
    ).toMatch(/Términos para Empresas/)
  })

  it('takes phones typed with spaces and refuses letters', () => {
    expect(normalizePhone('+57 300-123 4567')).toBe('+573001234567')
    expect(
      companyRegisterSchema.safeParse({ ...company, contactPhone: 'abc' })
        .success,
    ).toBe(false)
  })

  it('refuses an email that is not one', () => {
    expect(
      companyRegisterSchema.safeParse({ ...company, billingEmail: 'facturas' })
        .success,
    ).toBe(false)
  })
})

describe('invitation and member amounts', () => {
  const invite = {
    companyId: ID,
    role: 'member' as const,
    monthlyBudget: 300_000,
    perOrderLimit: null,
    maxUses: 1,
    expiresDays: 7,
  }

  it('accepts no limit (null) or whole pesos', () => {
    expect(invitationCreateSchema.safeParse(invite).success).toBe(true)
    expect(
      invitationCreateSchema.safeParse({ ...invite, monthlyBudget: null })
        .success,
    ).toBe(true)
    expect(
      invitationCreateSchema.safeParse({ ...invite, monthlyBudget: 1500.5 })
        .success,
    ).toBe(false)
  })

  it('keeps a link to 30 days and 200 people', () => {
    expect(
      invitationCreateSchema.safeParse({ ...invite, expiresDays: 31 }).success,
    ).toBe(false)
    expect(
      invitationCreateSchema.safeParse({ ...invite, maxUses: 201 }).success,
    ).toBe(false)
  })

  it('validates a team change', () => {
    expect(
      memberUpdateSchema.safeParse({
        memberId: ID,
        role: 'admin',
        monthlyBudget: null,
        perOrderLimit: 80_000,
        active: true,
      }).success,
    ).toBe(true)
  })
})

describe('admin and merchant forms', () => {
  it('approves with a listed payment term and a tip cap up to 30 %', () => {
    const approval = {
      companyId: ID,
      creditLimit: 2_000_000,
      paymentTermsDays: 30,
      maxTipPct: 10,
    }
    expect(companyApprovalSchema.safeParse(approval).success).toBe(true)
    expect(
      companyApprovalSchema.safeParse({ ...approval, paymentTermsDays: 20 })
        .success,
    ).toBe(false)
    expect(
      companyApprovalSchema.safeParse({ ...approval, maxTipPct: 31 }).success,
    ).toBe(false)
  })

  it('takes a month as its first day', () => {
    expect(statementPeriodSchema.safeParse('2026-10-01').success).toBe(true)
    expect(statementPeriodSchema.safeParse('2026-10-15').success).toBe(false)
  })

  it('needs an invoice number', () => {
    expect(
      merchantInvoiceSchema.safeParse({ orderId: ID, invoiceRef: ' ' }).success,
    ).toBe(false)
    expect(
      merchantInvoiceSchema.safeParse({ orderId: ID, invoiceRef: 'FE-1234' })
        .success,
    ).toBe(true)
  })
})

describe('parsePesosInput', () => {
  it('reads pesos with thousands dots or a sign, empty as no limit', () => {
    expect(parsePesosInput('300.000')).toBe(300_000)
    expect(parsePesosInput('$ 45000')).toBe(45_000)
    expect(parsePesosInput('  ')).toBeNull()
    expect(parsePesosInput('12,5')).toBeNaN()
    expect(parsePesosInput('abc')).toBeNaN()
  })
})
