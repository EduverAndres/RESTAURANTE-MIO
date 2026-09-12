import { z } from 'zod'
import { USER_ROLES } from '@/lib/auth/roles'
import type { StoreStatus, UserRole } from '@/types/app'

export const STORE_STATUSES: readonly StoreStatus[] = [
  'pending',
  'active',
  'suspended',
]

export const storeStatusSchema = z.enum(
  STORE_STATUSES as [StoreStatus, ...StoreStatus[]],
)

export const userRoleSchema = z.enum(USER_ROLES as [UserRole, ...UserRole[]])

/** 0 to 30 %, at most one decimal, matching the merchant commission range. */
export const commissionPctSchema = z
  .number({ error: 'La comisión debe ser un número.' })
  .min(0, 'La comisión debe ser al menos 0 %.')
  .max(30, 'La comisión no puede superar 30 %.')
  .refine((value) => Math.round(value * 10) / 10 === value, {
    message: 'Usa como máximo un decimal.',
  })

/** Date-only string (`YYYY-MM-DD`) used for payout periods. */
export const periodDateSchema = z
  .string()
  .regex(/^\d{4}-\d{2}-\d{2}$/, 'Fecha inválida.')
