// Courier approval rules. Pure: no React, no Supabase.
//
// Registration as a courier is open, but taking deliveries is not: a courier
// carries other people's food and, on cash orders, their money. Before the
// pool opens to someone, the platform has their identity and vehicle on file
// and an admin has approved them. A motorised courier also needs a valid
// driving licence and SOAT; when either expires the pool closes again on its
// own, with no admin involved.
//
// MIRRORED IN SQL: `isCourierActive` is `public.is_active_courier()`, which
// the order policies use to open the pool (COURIER_ACTIVE_RULE in
// lib/couriers/sql.ts; tests/couriers-sql-drift.test.ts).
import {
  isMotorized,
  type CourierStatus,
  type VehicleType,
} from '@/lib/couriers/vocabulary'

export interface CourierProfileFacts {
  status: CourierStatus
  vehicle_type: VehicleType | null
  plate: string | null
  document_number: string | null
  city: string | null
  /** Date-only (`YYYY-MM-DD`). */
  license_expires_on: string | null
  soat_expires_on: string | null
}

/**
 * Whether the courier may see and take pool orders today. `today` is the
 * date in Bogotá (`YYYY-MM-DD`); a document valid through today still counts.
 */
export function isCourierActive(
  profile: Pick<
    CourierProfileFacts,
    'status' | 'vehicle_type' | 'license_expires_on' | 'soat_expires_on'
  > | null,
  today: string,
): boolean {
  if (!profile || profile.status !== 'approved') return false
  // The database never holds an approved profile without a vehicle (the
  // `courier_profiles_approved_complete` check); refusing it here too keeps
  // the rule identical to the SQL, where a null vehicle compares as NULL.
  if (profile.vehicle_type === null) return false
  if (!isMotorized(profile.vehicle_type)) return true
  return (
    profile.license_expires_on !== null &&
    profile.soat_expires_on !== null &&
    profile.license_expires_on >= today &&
    profile.soat_expires_on >= today
  )
}

/**
 * Why the pool is closed to this courier, in words they can act on, or null
 * when it is open. One sentence per state, so the banner and the refusal in
 * `claimOrder` say the same thing.
 */
export function courierBlockReason(
  profile: Pick<
    CourierProfileFacts,
    'status' | 'vehicle_type' | 'license_expires_on' | 'soat_expires_on'
  > | null,
  today: string,
): string | null {
  if (isCourierActive(profile, today)) return null
  if (!profile)
    return 'Completa tu perfil de domiciliario para empezar a tomar pedidos.'
  if (profile.status === 'pending')
    return 'Tu perfil está en revisión. Te avisamos cuando lo aprobemos.'
  if (profile.status === 'suspended')
    return 'Tu cuenta de domiciliario está suspendida. Escríbenos si crees que es un error.'
  return 'Tu licencia o tu SOAT está vencido. Actualiza las fechas en tu perfil para seguir tomando pedidos.'
}

export type MissingField =
  | 'vehicle_type'
  | 'document_number'
  | 'city'
  | 'plate'
  | 'license_expires_on'
  | 'soat_expires_on'

export const MISSING_FIELD_LABELS: Record<MissingField, string> = {
  vehicle_type: 'el vehículo',
  document_number: 'el número de documento',
  city: 'la ciudad',
  plate: 'la placa',
  license_expires_on: 'el vencimiento de la licencia',
  soat_expires_on: 'el vencimiento del SOAT',
}

/**
 * What still has to be on file before an admin can approve the profile.
 * Mirrors the `courier_profiles_approved_complete` check in SQL.
 */
export function missingForApproval(
  profile: Omit<CourierProfileFacts, 'status'>,
): MissingField[] {
  const missing: MissingField[] = []
  if (!profile.vehicle_type) missing.push('vehicle_type')
  if (!profile.document_number) missing.push('document_number')
  if (!profile.city) missing.push('city')
  if (isMotorized(profile.vehicle_type)) {
    if (!profile.plate) missing.push('plate')
    if (!profile.license_expires_on) missing.push('license_expires_on')
    if (!profile.soat_expires_on) missing.push('soat_expires_on')
  }
  return missing
}

/**
 * The status after the courier edits their own profile.
 *
 * Changing who they are or what they ride (document, vehicle, plate) sends an
 * approved profile back to review: the admin approved the old one. Renewing a
 * document's expiry or moving zone keeps the approval, because that is the
 * courier keeping their papers current, not a different courier. A suspended
 * courier stays suspended whatever they edit; only an admin lifts it.
 */
export function statusAfterEdit(
  previous: Pick<
    CourierProfileFacts,
    'status' | 'vehicle_type' | 'plate' | 'document_number'
  > | null,
  next: Pick<CourierProfileFacts, 'vehicle_type' | 'plate' | 'document_number'>,
): CourierStatus {
  if (!previous) return 'pending'
  if (previous.status === 'suspended') return 'suspended'
  if (previous.status === 'pending') return 'pending'
  const changedIdentity =
    previous.vehicle_type !== next.vehicle_type ||
    (previous.plate ?? null) !== (next.plate ?? null) ||
    (previous.document_number ?? null) !== (next.document_number ?? null)
  return changedIdentity ? 'pending' : 'approved'
}

export interface ExpiringDocument {
  document: 'license' | 'soat'
  expiresOn: string
  expired: boolean
}

/** Documents that expired, or expire within `withinDays` of `today`. */
export function expiringDocuments(
  profile: Pick<
    CourierProfileFacts,
    'vehicle_type' | 'license_expires_on' | 'soat_expires_on'
  >,
  today: string,
  withinDays = 15,
): ExpiringDocument[] {
  if (!isMotorized(profile.vehicle_type)) return []
  const horizon = addDays(today, withinDays)
  const out: ExpiringDocument[] = []
  const check = (document: 'license' | 'soat', expiresOn: string | null) => {
    if (!expiresOn) return
    if (expiresOn <= horizon)
      out.push({ document, expiresOn, expired: expiresOn < today })
  }
  check('license', profile.license_expires_on)
  check('soat', profile.soat_expires_on)
  return out
}

function addDays(date: string, days: number): string {
  const next = new Date(`${date}T00:00:00.000Z`)
  next.setUTCDate(next.getUTCDate() + days)
  return next.toISOString().slice(0, 10)
}

/** Today in Bogotá (UTC-5, no daylight saving), as `YYYY-MM-DD`. */
export function bogotaToday(now: Date = new Date()): string {
  return new Date(now.getTime() - 5 * 60 * 60 * 1000).toISOString().slice(0, 10)
}
