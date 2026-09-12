interface FieldErrorProps {
  id: string
  message?: string
}

/** Inline validation message wired to `aria-describedby`. */
export function FieldError({ id, message }: FieldErrorProps) {
  if (!message) return null
  return (
    <p id={id} role="alert" className="text-destructive text-xs">
      {message}
    </p>
  )
}
