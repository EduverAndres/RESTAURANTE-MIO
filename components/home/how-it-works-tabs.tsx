'use client'

import { ArrowRightIcon, BikeIcon, CalendarCheckIcon } from 'lucide-react'
import Link from 'next/link'
import { useState } from 'react'
import { PillTabsList, PillTabsTrigger } from '@/components/motion/pill-tabs'
import { useHydrated } from '@/components/motion/use-hydrated'
import { Button } from '@/components/ui/button'
import { Tabs, TabsContent } from '@/components/ui/tabs'
import { cn } from '@/lib/utils'

export interface HowItWorksFlow {
  value: 'pedir' | 'reservar'
  label: string
  note: string
  steps: readonly { title: string; text: string }[]
  action: { href: string; label: string }
}

const ICONS = { pedir: BikeIcon, reservar: CalendarCheckIcon } as const

/**
 * The two flows a customer has — ordering and booking — as tabs over the
 * same three-step layout. The numbers are information (it is a sequence),
 * so they stay; the rule joining them draws itself as the panel scrolls in
 * (`reveal-line`), and each step fades up (`reveal`), both in CSS and both
 * off with reduced motion.
 *
 * As in AudienceSwitcher, every panel is in the HTML and all of them show
 * until the page has hydrated.
 */
export function HowItWorksTabs({
  flows,
}: {
  flows: readonly HowItWorksFlow[]
}) {
  const [active, setActive] = useState(flows[0]?.value ?? 'pedir')
  const hydrated = useHydrated()

  return (
    <Tabs
      value={active}
      onValueChange={(value) => setActive(value as HowItWorksFlow['value'])}
      className="gap-8"
    >
      <PillTabsList aria-label="¿Qué quieres hacer?" className="w-fit">
        {flows.map(({ value, label }) => {
          const Icon = ICONS[value]
          return (
            <PillTabsTrigger
              key={value}
              value={value}
              active={active === value}
              layoutId="how-it-works-indicator"
              className="px-5"
            >
              <Icon aria-hidden="true" className="size-4" />
              {label}
            </PillTabsTrigger>
          )
        })}
      </PillTabsList>

      {flows.map((flow) => (
        <TabsContent
          key={flow.value}
          value={flow.value}
          forceMount
          className={cn(
            'data-[state=active]:animate-fade-up space-y-8 text-base',
            hydrated && 'data-[state=inactive]:hidden',
          )}
        >
          <p className="text-muted-foreground max-w-2xl text-pretty">
            {flow.note}
          </p>

          <div className="relative">
            {/* The thread between the numbers, from the first to the last. */}
            <div
              aria-hidden="true"
              className="absolute top-6 right-[16.66%] left-[16.66%] hidden sm:block"
            >
              <div className="reveal-line bg-primary/30 h-0.5 w-full rounded-full" />
            </div>

            <ol className="gap-card relative grid sm:grid-cols-3">
              {flow.steps.map((step, index) => (
                <li
                  key={step.title}
                  className="reveal flex gap-4 sm:flex-col sm:items-center sm:text-center"
                >
                  <span
                    aria-hidden="true"
                    className="bg-primary text-primary-foreground font-display shadow-2 ring-background grid size-12 shrink-0 place-items-center rounded-full text-xl font-semibold tabular-nums ring-4"
                  >
                    {index + 1}
                  </span>
                  <div className="space-y-1.5">
                    <h3 className="font-display text-xl font-semibold">
                      <span className="sr-only">Paso {index + 1}: </span>
                      {step.title}
                    </h3>
                    <p className="text-muted-foreground text-sm text-pretty">
                      {step.text}
                    </p>
                  </div>
                </li>
              ))}
            </ol>
          </div>

          <Button
            asChild
            size="lg"
            className="rounded-pill h-12 px-6 text-base"
          >
            <Link href={flow.action.href}>
              {flow.action.label}
              <ArrowRightIcon aria-hidden="true" data-icon="inline-end" />
            </Link>
          </Button>
        </TabsContent>
      ))}
    </Tabs>
  )
}
