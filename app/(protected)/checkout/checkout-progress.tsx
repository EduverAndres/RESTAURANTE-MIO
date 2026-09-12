'use client'

import { CheckIcon } from 'lucide-react'
import { cn } from '@/lib/utils'
import type { Step } from './steps'

interface CheckoutProgressProps {
  steps: readonly { id: Step; label: string }[]
  current: Step
  /** Jump back to a step already completed. */
  onSelect: (step: Step) => void
}

/**
 * The phone-sized progress bar.
 *
 * Two things at once: a filled track that says how far along you are without
 * being read, and three labelled stops that say what is left. Completed
 * stops are buttons, because going back to change the address is the most
 * common thing anyone does in a checkout; the step ahead is not, because it
 * has not been validated yet.
 */
export function CheckoutProgress({
  steps,
  current,
  onSelect,
}: CheckoutProgressProps) {
  const index = steps.findIndex((step) => step.id === current)
  const progress = ((index + 1) / steps.length) * 100

  return (
    <nav aria-label="Pasos del pago" className="mb-6 md:hidden">
      <div
        className="bg-muted mb-3 h-1.5 w-full overflow-hidden rounded-full"
        role="progressbar"
        aria-valuemin={1}
        aria-valuemax={steps.length}
        aria-valuenow={index + 1}
        aria-valuetext={`Paso ${index + 1} de ${steps.length}: ${steps[index]?.label ?? ''}`}
      >
        <span
          className="bg-primary ease-out-soft block h-full rounded-full transition-[width] duration-300"
          style={{ width: `${progress}%` }}
        />
      </div>
      <ol className="flex items-center justify-between gap-2">
        {steps.map((step, position) => {
          const done = position < index
          const active = position === index
          const label = (
            <>
              <span
                className={cn(
                  'grid size-6 shrink-0 place-items-center rounded-full text-[11px] font-semibold',
                  done
                    ? 'bg-success text-success-foreground'
                    : active
                      ? 'bg-primary text-primary-foreground'
                      : 'bg-muted text-muted-foreground',
                )}
              >
                {done ? (
                  <CheckIcon aria-hidden="true" className="size-3.5" />
                ) : (
                  position + 1
                )}
              </span>
              <span
                className={cn(
                  'text-xs font-medium',
                  active ? 'text-foreground' : 'text-muted-foreground',
                )}
              >
                {step.label}
              </span>
            </>
          )

          return (
            <li key={step.id}>
              {done ? (
                <button
                  type="button"
                  onClick={() => onSelect(step.id)}
                  className="rounded-pill flex items-center gap-2 py-1 pr-2"
                >
                  {label}
                  <span className="sr-only">— completado, volver</span>
                </button>
              ) : (
                <span
                  aria-current={active ? 'step' : undefined}
                  className="flex items-center gap-2 py-1 pr-2"
                >
                  {label}
                </span>
              )}
            </li>
          )
        })}
      </ol>
    </nav>
  )
}
