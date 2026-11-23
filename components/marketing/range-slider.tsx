'use client'

import { useId } from 'react'

export interface RangeSliderProps {
  label: string
  value: number
  min: number
  max: number
  step: number
  /** The value as people read it ("$5.000", "20 días"); also its aria text. */
  display: string
  onChange: (value: number) => void
}

/** A labelled range input that shows its value, for the landing calculators. */
export function RangeSlider({
  label,
  value,
  min,
  max,
  step,
  display,
  onChange,
}: RangeSliderProps) {
  const id = useId()
  return (
    <div className="space-y-1">
      <div className="flex items-baseline justify-between gap-3">
        <label htmlFor={id} className="text-small font-medium">
          {label}
        </label>
        <span className="font-display text-xl font-semibold tabular-nums">
          {display}
        </span>
      </div>
      <input
        id={id}
        type="range"
        min={min}
        max={max}
        step={step}
        value={value}
        aria-valuetext={display}
        onChange={(event) => onChange(Number(event.target.value))}
        className="accent-primary h-11 w-full cursor-pointer"
      />
    </div>
  )
}
