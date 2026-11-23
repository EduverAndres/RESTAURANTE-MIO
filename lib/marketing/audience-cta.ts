/**
 * The one call to action each audience landing puts in its header: whoever
 * reads /repartidores wants to sign up as a courier, not open a store. Pure,
 * so the mapping is tested without rendering the layout.
 */

export interface AudienceCta {
  label: string
  /** For narrow headers and the mobile bar, where the full label wraps. */
  shortLabel: string
  href: string
}

const CTAS: readonly { prefix: string; cta: AudienceCta }[] = [
  {
    prefix: '/para-restaurantes',
    cta: {
      label: 'Crear mi tienda',
      shortLabel: 'Crear tienda',
      href: '/register?role=merchant',
    },
  },
  {
    prefix: '/repartidores',
    cta: {
      label: 'Quiero repartir',
      shortLabel: 'Repartir',
      href: '/register?role=courier',
    },
  },
  {
    prefix: '/empresas',
    cta: {
      label: 'Crear cuenta de empresa',
      shortLabel: 'Cuenta de empresa',
      href: '/empresa/registro',
    },
  },
]

/** The CTA for `pathname`, or null on a page that is not an audience landing. */
export function audienceCtaFor(pathname: string | null): AudienceCta | null {
  if (!pathname) return null
  const match = CTAS.find(
    ({ prefix }) => pathname === prefix || pathname.startsWith(`${prefix}/`),
  )
  return match?.cta ?? null
}
