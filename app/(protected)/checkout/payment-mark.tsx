import { BanknoteIcon, CreditCardIcon, WalletIcon } from 'lucide-react'
import { cn } from '@/lib/utils'
import type { PaymentMethod } from '@/types/app'

/**
 * The mark beside each payment method.
 *
 * Gateways are recognised by their logo, not by their name, so a row of
 * identical grey card icons is a row nobody reads. These are monograms drawn
 * from the app's own tokens rather than the providers' trademarked artwork:
 * they give each method a distinct silhouette and colour without shipping
 * someone else's brand — or a hard-coded hex — into the bundle.
 */
const MONOGRAMS: Partial<Record<PaymentMethod, string>> = {
  wompi: 'W',
  mercadopago: 'MP',
}

const TILE_TONES: Partial<Record<PaymentMethod, string>> = {
  cash: 'bg-success/12 text-success-on-tint',
  mock: 'bg-muted text-muted-foreground',
  wompi: 'bg-primary/12 text-primary-on-tint',
  mercadopago: 'bg-accent/20 text-foreground',
}

const ICONS: Partial<Record<PaymentMethod, React.ReactNode>> = {
  cash: <BanknoteIcon aria-hidden="true" className="size-5" />,
  mock: <CreditCardIcon aria-hidden="true" className="size-5" />,
}

export function PaymentMark({ method }: { method: PaymentMethod }) {
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
