'use client'

import { ArrowRightIcon } from 'lucide-react'
import Link from 'next/link'
import { usePathname } from 'next/navigation'
import { Button } from '@/components/ui/button'
import { audienceCtaFor } from '@/lib/marketing/audience-cta'
import { cn } from '@/lib/utils'

/**
 * The audience landing's own call to action, chosen by route
 * (`audienceCtaFor`): "Crear mi tienda" on /para-restaurantes, "Quiero
 * repartir" on /repartidores, "Crear cuenta de empresa" on /empresas.
 *
 * `header` is the button in the top bar, from `sm` up. `bar` is the same
 * action pinned to the bottom of the screen below `sm`, where the header has
 * no room for it next to the accessibility and theme controls; it brings its
 * own spacer so the footer never ends up underneath it.
 */
export function MarketingCta({
  placement,
  className,
}: {
  placement: 'header' | 'bar'
  className?: string
}) {
  const cta = audienceCtaFor(usePathname())
  if (!cta) return null

  if (placement === 'header') {
    return (
      <Button
        asChild
        className={cn(
          'rounded-pill hidden h-10 px-4 sm:inline-flex',
          className,
        )}
      >
        <Link href={cta.href}>{cta.label}</Link>
      </Button>
    )
  }

  return (
    <>
      <div aria-hidden="true" className="h-20 sm:hidden" />
      <div
        className={cn(
          'surface-glass fixed inset-x-0 bottom-0 z-40 px-4 pt-3 pb-[calc(env(safe-area-inset-bottom)+0.75rem)] sm:hidden',
          className,
        )}
      >
        <Button
          asChild
          size="lg"
          className="rounded-pill h-12 w-full text-base"
        >
          <Link href={cta.href}>
            {cta.label}
            <ArrowRightIcon aria-hidden="true" data-icon="inline-end" />
          </Link>
        </Button>
      </div>
    </>
  )
}
