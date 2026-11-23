// Courier profile vocabulary. Pure, safe on client and server.
//
// MIRRORED IN SQL: the check constraints of `public.courier_profiles`
// (supabase/migrations/20261124000200_courier_profiles.sql) embed these lists
// between `codegen:` markers; tests/couriers-sql-drift.test.ts compares them.
import type { StatusTone } from '@/lib/orders/status'

export const COURIER_STATUSES = ['pending', 'approved', 'suspended'] as const
export type CourierStatus = (typeof COURIER_STATUSES)[number]

export const COURIER_STATUS_LABELS: Record<CourierStatus, string> = {
  pending: 'En revisión',
  approved: 'Aprobado',
  suspended: 'Suspendido',
}

export const COURIER_STATUS_TONES: Record<CourierStatus, StatusTone> = {
  pending: 'warning',
  approved: 'success',
  suspended: 'destructive',
}

export const VEHICLE_TYPES = [
  'motorcycle',
  'car',
  'bicycle',
  'on_foot',
] as const
export type VehicleType = (typeof VEHICLE_TYPES)[number]

export const VEHICLE_LABELS: Record<VehicleType, string> = {
  motorcycle: 'Moto',
  car: 'Carro',
  bicycle: 'Bicicleta',
  on_foot: 'A pie',
}

/** Vehicles that need a plate, a driving licence and SOAT on the road. */
export const MOTORIZED_VEHICLES: readonly VehicleType[] = ['motorcycle', 'car']

export function isMotorized(vehicle: VehicleType | null): boolean {
  return vehicle !== null && MOTORIZED_VEHICLES.includes(vehicle)
}
