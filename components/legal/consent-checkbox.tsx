import { cn } from '@/lib/utils'

function DocLink({ href, children }: { href: string; children: string }) {
  return (
    // A new tab, so reading the document never costs the half-filled form.
    <a
      href={href}
      target="_blank"
      rel="noopener noreferrer"
      className="text-foreground font-medium underline underline-offset-2"
    >
      {children}
    </a>
  )
}

type ConsentCheckboxProps = Omit<React.ComponentProps<'input'>, 'type'> & {
  id: string
  error?: string
  /**
   * `partner` adds the merchant and courier terms, for an account that will
   * sell or deliver through the platform.
   */
  audience?: 'customer' | 'partner'
  className?: string
}

/**
 * The express-consent box the law asks for: unticked by default, worded as
 * a statement the person makes, linking every document it covers, and with
 * its error tied to it for a screen reader.
 */
export function ConsentCheckbox({
  id,
  error,
  audience = 'customer',
  className,
  ...inputProps
}: ConsentCheckboxProps) {
  const errorId = `${id}-error`
  return (
    <div className={cn('space-y-1.5', className)}>
      <div className="flex items-start gap-3">
        <input
          id={id}
          type="checkbox"
          aria-invalid={Boolean(error)}
          aria-describedby={error ? errorId : undefined}
          className="accent-primary border-input mt-0.5 size-5 shrink-0 cursor-pointer rounded"
          {...inputProps}
        />
        <label
          htmlFor={id}
          className="text-muted-foreground cursor-pointer text-sm leading-snug"
        >
          He leído y acepto los{' '}
          <DocLink href="/terminos">Términos y Condiciones</DocLink>
          {audience === 'partner' ? (
            <>
              , los{' '}
              <DocLink href="/terminos-aliados">
                Términos para Comercios y Repartidores
              </DocLink>
            </>
          ) : null}{' '}
          y autorizo el tratamiento de mis datos personales conforme a la{' '}
          <DocLink href="/privacidad">Política de Tratamiento de Datos</DocLink>
          .
        </label>
      </div>
      {error ? (
        <p id={errorId} role="alert" className="text-destructive text-xs">
          {error}
        </p>
      ) : null}
    </div>
  )
}

/**
 * The separate, optional authorisation for promotional messages. Never
 * required and never bundled with the box above (Ley 1581, art. 6 and the
 * SIC's guidance on consent for marketing).
 */
export function MarketingCheckbox({
  id,
  className,
  ...inputProps
}: Omit<React.ComponentProps<'input'>, 'type'> & { id: string }) {
  return (
    <div className={cn('flex items-start gap-3', className)}>
      <input
        id={id}
        type="checkbox"
        className="accent-primary border-input mt-0.5 size-5 shrink-0 cursor-pointer rounded"
        {...inputProps}
      />
      <label
        htmlFor={id}
        className="text-muted-foreground cursor-pointer text-sm leading-snug"
      >
        Quiero recibir promociones y novedades por correo, SMS o WhatsApp
        (opcional, puedes retirarlo cuando quieras).
      </label>
    </div>
  )
}
