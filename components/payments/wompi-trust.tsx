import Image from 'next/image'
import { cn } from '@/lib/utils'

/**
 * Who is actually taking the money.
 *
 * A checkout that names its gateway converts better than one that does not,
 * because the buyer has seen that logo before and has not seen ours. The
 * artwork is Wompi's own, downloaded from its official resources page, which
 * exists precisely so merchants can show it: only those files, proportions
 * untouched, room around the mark.
 *
 * The logo Wompi publishes is solid black (or solid white). It sits on a
 * white pill so it reads the same on the light app chrome, in dark mode and
 * inside a dark store theme -- the way card brands are shown everywhere, and
 * the one background the brand rules never argue with.
 *
 * PCI is stated in words and attributed to Wompi: card data is entered on
 * Wompi's hosted checkout and never touches this app. Wompi's PCI seal file
 * is a 1920x1080 artboard with the seal small inside it, unusable at badge
 * size without cropping an official asset, so it is not shown.
 *
 * The image box is fixed (the wordmark is 1982x997, so 48x24) rather than
 * `w-auto`: an SVG's intrinsic size is not known until it loads, and the
 * first screenshot had the text laid out over a pill that was still zero
 * wide.
 */

// "Principal" is the solid-black wordmark (fill #2C2A29 throughout); the
// white variants would vanish on the pill. Checked against the files' fills.
const WORDMARK = '/brand/wompi/Wompi_LogoPrincipal.svg'

export function WompiTrust({
  className,
  compact = false,
}: {
  className?: string
  /** One line, for headers; the default is a small explanatory block. */
  compact?: boolean
}) {
  return (
    <div
      className={cn(
        'text-muted-foreground flex items-center gap-3 text-xs',
        compact ? '' : 'rounded-control bg-muted/50 px-3 py-3',
        className,
      )}
    >
      <span className="flex h-10 shrink-0 items-center rounded-md bg-white px-3 shadow-1">
        <Image
          src={WORDMARK}
          alt="Wompi"
          width={48}
          height={24}
          unoptimized
          className="h-6 w-12"
        />
      </span>
      <p className="min-w-0 leading-snug">
        <span className="text-foreground font-medium">
          Pagos procesados por Wompi
        </span>
        {compact ? null : (
          <>
            , la pasarela de Bancolombia, certificada PCI DSS. Tus datos de
            tarjeta se ingresan en su plataforma y nunca pasan por esta tienda.
          </>
        )}
      </p>
    </div>
  )
}
