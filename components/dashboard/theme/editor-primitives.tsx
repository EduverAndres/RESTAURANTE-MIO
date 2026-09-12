'use client'

import { Accordion } from 'radix-ui'
import { ChevronDownIcon } from 'lucide-react'
import { useId } from 'react'
import { FieldError } from '@/components/dashboard/store/field-error'
import { describedBy, errorId, hintId } from '@/lib/a11y/forms'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { Switch } from '@/components/ui/switch'
import { Textarea } from '@/components/ui/textarea'
import { cn } from '@/lib/utils'

/**
 * The small controls the theme editor is built out of.
 *
 * They exist here rather than in components/ui because they are opinionated
 * about the editor's rhythm (label above, hint below, error last) and because
 * every one of them is a *controlled* input driven by one theme object — there
 * is no form library underneath, the theme is the single source of truth.
 */

// ---------------------------------------------------------------------------
// Accordion
// ---------------------------------------------------------------------------

export function EditorAccordion({
  value,
  onValueChange,
  children,
}: {
  value: string[]
  onValueChange: (value: string[]) => void
  children: React.ReactNode
}) {
  return (
    <Accordion.Root
      type="multiple"
      value={value}
      onValueChange={onValueChange}
      className="divide-border border-border divide-y rounded-[var(--radius-lg)] border"
    >
      {children}
    </Accordion.Root>
  )
}

export function EditorSection({
  value,
  title,
  summary,
  icon: Icon,
  children,
}: {
  value: string
  title: string
  summary?: string
  icon: React.ComponentType<{ className?: string; 'aria-hidden'?: boolean }>
  children: React.ReactNode
}) {
  return (
    <Accordion.Item value={value} className="scroll-mt-24">
      <Accordion.Header>
        <Accordion.Trigger className="group focus-visible:ring-ring/50 hover:bg-muted/50 flex w-full items-center gap-3 px-4 py-3.5 text-left outline-none focus-visible:ring-3">
          <Icon aria-hidden className="text-muted-foreground size-4 shrink-0" />
          <span className="min-w-0 flex-1">
            <span className="block text-sm font-medium">{title}</span>
            {summary ? (
              <span className="text-muted-foreground block truncate text-xs">
                {summary}
              </span>
            ) : null}
          </span>
          <ChevronDownIcon
            aria-hidden
            className="text-muted-foreground size-4 shrink-0 transition-transform duration-[--duration-fast] group-data-[state=open]:rotate-180"
          />
        </Accordion.Trigger>
      </Accordion.Header>
      <Accordion.Content className="overflow-hidden">
        <div className="space-y-5 px-4 pt-1 pb-5">{children}</div>
      </Accordion.Content>
    </Accordion.Item>
  )
}

// ---------------------------------------------------------------------------
// Field shell
// ---------------------------------------------------------------------------

interface FieldShellProps {
  id: string
  label: string
  hint?: string
  error?: string
  /** Rendered to the right of the label, e.g. a live value readout. */
  aside?: React.ReactNode
  children: React.ReactNode
}

export function FieldShell({
  id,
  label,
  hint,
  error,
  aside,
  children,
}: FieldShellProps) {
  return (
    <div className="space-y-1.5">
      <div className="flex items-baseline justify-between gap-3">
        <Label htmlFor={id}>{label}</Label>
        {aside ? (
          <span className="text-muted-foreground text-xs tabular-nums">
            {aside}
          </span>
        ) : null}
      </div>
      {children}
      {hint ? (
        <p id={hintId(id)} className="text-muted-foreground text-xs">
          {hint}
        </p>
      ) : null}
      <FieldError id={errorId(id)} message={error} />
    </div>
  )
}

/**
 * What a `FieldShell` child should spread onto its control so the hint and
 * the error it renders are actually reachable from the field.
 */
export function fieldShellProps(
  id: string,
  { hint, error }: { hint?: string; error?: string },
) {
  return {
    'aria-invalid': Boolean(error) || undefined,
    'aria-describedby': describedBy(
      Boolean(hint) && hintId(id),
      Boolean(error) && errorId(id),
    ),
  }
}

// ---------------------------------------------------------------------------
// Segmented control
// ---------------------------------------------------------------------------

export interface Choice<T extends string | number> {
  value: T
  label: string
  /** Optional preview rendered inside the button instead of plain text. */
  preview?: React.ReactNode
}

/**
 * A radio group that looks like a row of chips. Native radios underneath, so
 * arrow keys move between the options and screen readers announce the group.
 */
export function SegmentedField<T extends string | number>({
  label,
  value,
  options,
  onChange,
  hint,
  error,
  columns,
}: {
  label: string
  value: T
  options: readonly Choice<T>[]
  onChange: (value: T) => void
  hint?: string
  error?: string
  /** Force a grid instead of a wrapping row. */
  columns?: 2 | 3 | 4
}) {
  const name = useId()
  return (
    <fieldset
      className="space-y-1.5"
      aria-invalid={Boolean(error) || undefined}
      // The group owns the error, because no single radio caused it.
      aria-describedby={describedBy(
        Boolean(hint) && hintId(name),
        Boolean(error) && errorId(name),
      )}
    >
      <legend className="mb-1.5 text-sm leading-none font-medium">
        {label}
      </legend>
      <div
        className={cn(
          columns ? 'grid gap-1.5' : 'flex flex-wrap gap-1.5',
          columns === 2 && 'grid-cols-2',
          columns === 3 && 'grid-cols-3',
          columns === 4 && 'grid-cols-2 sm:grid-cols-4',
        )}
      >
        {options.map((option) => (
          <label
            key={String(option.value)}
            className="has-focus-visible:ring-ring/50 border-border hover:bg-muted/60 has-checked:border-primary has-checked:bg-primary/10 has-checked:text-foreground text-muted-foreground flex min-h-9 cursor-pointer items-center justify-center gap-1.5 rounded-[var(--radius-md)] border px-2.5 py-1.5 text-center text-xs font-medium transition-colors has-focus-visible:ring-3"
          >
            <input
              type="radio"
              name={name}
              className="sr-only"
              checked={value === option.value}
              onChange={() => onChange(option.value)}
            />
            {option.preview ?? option.label}
          </label>
        ))}
      </div>
      {hint ? (
        <p id={hintId(name)} className="text-muted-foreground text-xs">
          {hint}
        </p>
      ) : null}
      <FieldError id={errorId(name)} message={error} />
    </fieldset>
  )
}

// ---------------------------------------------------------------------------
// Slider, switch, text
// ---------------------------------------------------------------------------

export function SliderField({
  label,
  value,
  min,
  max,
  step,
  onChange,
  format,
  hint,
  error,
}: {
  label: string
  value: number
  min: number
  max: number
  step: number
  onChange: (value: number) => void
  format?: (value: number) => string
  hint?: string
  error?: string
}) {
  const id = useId()
  return (
    <FieldShell
      id={id}
      label={label}
      hint={hint}
      error={error}
      aside={format ? format(value) : value}
    >
      <input
        id={id}
        type="range"
        min={min}
        max={max}
        step={step}
        value={value}
        {...fieldShellProps(id, { hint, error })}
        className="accent-primary focus-visible:ring-ring/50 h-9 w-full rounded-full outline-none focus-visible:ring-3"
        onChange={(event) => onChange(Number(event.target.value))}
      />
    </FieldShell>
  )
}

export function SwitchField({
  label,
  hint,
  checked,
  onChange,
}: {
  label: string
  hint?: string
  checked: boolean
  onChange: (checked: boolean) => void
}) {
  const id = useId()
  return (
    <div className="flex items-start justify-between gap-4">
      <div className="min-w-0 space-y-0.5">
        <Label htmlFor={id}>{label}</Label>
        {hint ? (
          <p id={hintId(id)} className="text-muted-foreground text-xs">
            {hint}
          </p>
        ) : null}
      </div>
      <Switch
        id={id}
        aria-describedby={describedBy(Boolean(hint) && hintId(id))}
        checked={checked}
        onCheckedChange={onChange}
      />
    </div>
  )
}

export function TextField({
  label,
  value,
  onChange,
  placeholder,
  maxLength,
  hint,
  error,
  inputMode,
}: {
  label: string
  value: string
  onChange: (value: string) => void
  placeholder?: string
  maxLength?: number
  hint?: string
  error?: string
  inputMode?: React.ComponentProps<'input'>['inputMode']
}) {
  const id = useId()
  return (
    <FieldShell
      id={id}
      label={label}
      hint={hint}
      error={error}
      aside={maxLength ? `${value.length}/${maxLength}` : undefined}
    >
      <Input
        id={id}
        value={value}
        placeholder={placeholder}
        maxLength={maxLength}
        inputMode={inputMode}
        {...fieldShellProps(id, { hint, error })}
        className="rounded-control h-10"
        onChange={(event) => onChange(event.target.value)}
      />
    </FieldShell>
  )
}

export function TextAreaField({
  label,
  value,
  onChange,
  placeholder,
  maxLength,
  rows = 4,
  hint,
  error,
  mono,
}: {
  label: string
  value: string
  onChange: (value: string) => void
  placeholder?: string
  maxLength?: number
  rows?: number
  hint?: string
  error?: string
  mono?: boolean
}) {
  const id = useId()
  return (
    <FieldShell
      id={id}
      label={label}
      hint={hint}
      error={error}
      aside={maxLength ? `${value.length}/${maxLength}` : undefined}
    >
      <Textarea
        id={id}
        value={value}
        rows={rows}
        placeholder={placeholder}
        maxLength={maxLength}
        spellCheck={!mono}
        {...fieldShellProps(id, { hint, error })}
        className={cn('rounded-control', mono && 'font-mono text-xs')}
        onChange={(event) => onChange(event.target.value)}
      />
    </FieldShell>
  )
}
