// What the sign-in welcome says to each kind of user. Pure, so the copy is
// tested on its own and the component only renders it.
//
// Each role gets its own short scene, then the brand and a line that speaks
// to why this person opened the app:
//   * customers and couriers: a dotted route and a pin landing at the end of
//     it (things nearby, brought to you);
//   * merchants: the same idea the other way round, store to home, drawn
//     with less: their kitchen sends the order out;
//   * admins: a small panel whose bars rise, the platform at a glance.
import { isUserRole } from '@/lib/auth/roles'
import type { UserRole } from '@/types/app'

export const WELCOME_PHRASES: Record<UserRole, string> = {
  customer: 'Lo que te gusta, a minutos.',
  merchant: 'Tu cocina, en el mapa de tu barrio.',
  courier: 'Listo para salir a ruta.',
  admin: 'La plataforma, de un vistazo.',
}

/** The animation above the brand. */
export type WelcomeScene = 'route-pin' | 'store-to-home' | 'dashboard'

export const WELCOME_SCENES: Record<UserRole, WelcomeScene> = {
  customer: 'route-pin',
  merchant: 'store-to-home',
  courier: 'route-pin',
  admin: 'dashboard',
}

export interface WelcomeContent {
  /** Line under the brand. */
  phrase: string
  scene: WelcomeScene
}

/** Unknown roles are treated as customers, like everywhere else. */
export function welcomeFor(role: string | null | undefined): WelcomeContent {
  const resolved: UserRole = isUserRole(role) ? role : 'customer'
  return {
    phrase: WELCOME_PHRASES[resolved],
    scene: WELCOME_SCENES[resolved],
  }
}
