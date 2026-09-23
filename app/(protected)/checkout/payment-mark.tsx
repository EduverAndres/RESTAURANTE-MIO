import { BanknoteIcon, CreditCardIcon, WalletIcon } from 'lucide-react'
import Image from 'next/image'
import { cn } from '@/lib/utils'
import type { PaymentMethod } from '@/types/app'

/**
 * The mark beside each payment method.
 *
 * Gateways are recognised by their logo, not by their name, so a row of
 * identical grey card icons is a row nobody reads. Wompi gets its official
 * mark -- the files Wompi publishes for exactly this use, proportions
 * untouched, on the white tile its brand rules never argue with. Methods
 * without a gateway keep monochrome icons drawn from the app's own tokens.
 *
 * Mercado Pago is not integrated; until it is, it keeps a monogram rather
 * than borrowing artwork for a button that cannot be pressed.
 */
// "Principal" is the solid-black mark; "Secundaria" is the white one and
// would vanish on the tile. Checked against the files' fills, not the names.
const WOMPI_MARK = '/brand/wompi/Wompi_ContraccionPrincipal.svg'

const MONOGRAMS: Partial<Record<PaymentMethod, string>> = {
  mercadopago: 'MP',
}

const TILE_TONES: Partial<Record<PaymentMethod, string>> = {
  cash: 'bg-success/12 text-success-on-tint',
  mock: 'bg-muted text-muted-foreground',
  wompi: 'bg-white shadow-1',
  mercadopago: 'bg-accent/20 text-foreground',
}

const ICONS: Partial<Record<PaymentMethod, React.ReactNode>> = {
  cash: <BanknoteIcon aria-hidden="true" className="size-5" />,
  mock: <CreditCardIcon aria-hidden="true" className="size-5" />,
}

export function PaymentMark({ method }: { method: PaymentMethod }) {
  if (method === 'wompi') {
    return (
      <span
        className={cn(
          'rounded-control grid size-11 shrink-0 place-items-center',
          TILE_TONES.wompi,
        )}
      >
        <Image
          src={WOMPI_MARK}
          alt="Wompi"
          width={28}
          height={28}
          unoptimized
          className="size-7"
        />
      </span>
    )
  }

  const monogram = MONOGRAMS[method]
  return (
    <span
      aria-hidden="true"
      className={cn(
        'rounded-control grid size-11 shrink-0 place-items-center font-semibold',
        TILE_TONES[method] ?? 'bg-muted text-muted-foreground',
      )}
    >
      {monogram ? (
        <span className="font-display text-base tracking-tight">
          {monogram}
        </span>
      ) : (
        (ICONS[method] ?? <WalletIcon aria-hidden="true" className="size-5" />)
      )}
    </span>
  )
}
