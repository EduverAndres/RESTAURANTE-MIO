// What the sign-in welcome says to each kind of user. Pure, so the copy is
// tested on its own and the component only renders it.
//
// The scene (a pin landing at the end of a short route) tells everyone what
// Cerquita is — things nearby, brought to you — and the line under it speaks
// to why this person opened the app. Admins get the brand alone: they are
// here to operate the platform, not to be sold on it.
import { isUserRole } from '@/lib/auth/roles'
import type { UserRole } from '@/types/app'

export const WELCOME_PHRASES: Record<UserRole, string | null> = {
  customer: 'Lo que te gusta, a minutos.',
  merchant: 'Tu cocina, en el mapa de tu barrio.',
  courier: 'Listo para salir a ruta.',
  admin: null,
}

export interface WelcomeContent {
  /** Line under the brand; null shows the brand alone. */
  phrase: string | null
  /** Whether the route-and-pin scene plays. */
  scene: boolean
}

/** Unknown roles are treated as customers, like everywhere else. */
export function welcomeFor(role: string | null | undefined): WelcomeContent {
  const resolved: UserRole = isUserRole(role) ? role : 'customer'
  const phrase = WELCOME_PHRASES[resolved]
  return { phrase, scene: resolved !== 'admin' }
}
