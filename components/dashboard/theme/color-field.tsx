'use client'

import { FieldError } from '@/components/dashboard/store/field-error'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'

interface ColorFieldProps {
  id: string
  label: string
  value: string
  error?: string
  onChange: (value: string) => void
}

const SIX_DIGIT_HEX = /^#[0-9a-f]{6}$/i

/** Native color picker paired with an editable hex text input. */
export function ColorField({
  id,
  label,
  value,
  error,
  onChange,
}: ColorFieldProps) {
  // The picker only accepts a full hex; keep the last valid one as swatch.
  const swatch = SIX_DIGIT_HEX.test(value) ? value : '#000000'
  return (
    <div className="space-y-1.5">
      <Label htmlFor={id}>{label}</Label>
      <div className="flex items-center gap-2">
        <input
          type="color"
          aria-label={`Selector de ${label.toLowerCase()}`}
          value={swatch}
          onChange={(event) => onChange(event.target.value.toUpperCase())}
          className="rounded-control border-border size-11 shrink-0 cursor-pointer border bg-transparent p-1"
        />
        <Input
          id={id}
          value={value}
          spellCheck={false}
          maxLength={7}
          aria-invalid={Boolean(error)}
          aria-describedby={`${id}-error`}
          className="rounded-control h-11 font-mono uppercase"
          onChange={(event) => onChange(event.target.value)}
        />
      </div>
      <FieldError id={`${id}-error`} message={error} />
    </div>
  )
}
