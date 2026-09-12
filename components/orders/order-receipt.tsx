import { formatCOP } from '@/lib/format'
import type { OrderItemOption } from '@/types/app'

export interface ReceiptItem {
  id: string
  name_snapshot: string
  quantity: number
  unit_price: number | string
  /** Generated column; null until the row is re-read after insert. */
  line_total: number | string | null
  options: unknown
}

function lineTotal(item: ReceiptItem) {
  return item.line_total === null
    ? Number(item.unit_price) * item.quantity
    : Number(item.line_total)
}

interface OrderReceiptProps {
  items: ReceiptItem[]
  subtotal: number
  deliveryFee: number
  tip: number
  total: number
  notes: string | null
  /** Extra lines under the totals (payment method, table, ...). */
  footer?: React.ReactNode
}

/** Presentational list of lines and totals shared by order detail pages. */
export function OrderReceipt({
  items,
  subtotal,
  deliveryFee,
  tip,
  total,
  notes,
  footer,
}: OrderReceiptProps) {
  return (
    <div className="space-y-4">
      <ul className="divide-border divide-y">
        {items.map((item) => {
          const options = (item.options ?? []) as unknown as OrderItemOption[]
          return (
            <li
              key={item.id}
              className="flex justify-between gap-3 py-2 text-sm"
            >
              <span className="min-w-0">
                <span className="block">
                  {item.quantity}× {item.name_snapshot}
                </span>
                {options.length > 0 ? (
                  <span className="text-muted-foreground block text-xs">
                    {options.map((option) => option.value).join(', ')}
                  </span>
                ) : null}
              </span>
              <span className="tabular-nums">{formatCOP(lineTotal(item))}</span>
            </li>
          )
        })}
      </ul>
      <dl className="space-y-1.5 text-sm">
        <div className="flex justify-between">
          <dt className="text-muted-foreground">Subtotal</dt>
          <dd className="tabular-nums">{formatCOP(subtotal)}</dd>
        </div>
        {deliveryFee > 0 ? (
          <div className="flex justify-between">
            <dt className="text-muted-foreground">Domicilio</dt>
            <dd className="tabular-nums">{formatCOP(deliveryFee)}</dd>
          </div>
        ) : null}
        {tip > 0 ? (
          <div className="flex justify-between">
            <dt className="text-muted-foreground">Propina</dt>
            <dd className="tabular-nums">{formatCOP(tip)}</dd>
          </div>
        ) : null}
        <div className="border-border flex justify-between border-t pt-2 text-base font-semibold">
          <dt>Total</dt>
          <dd className="tabular-nums">{formatCOP(total)}</dd>
        </div>
      </dl>
      {notes ? (
        <p className="rounded-control bg-muted/60 p-3 text-sm">
          <span className="font-medium">Notas:</span> {notes}
        </p>
      ) : null}
      {footer}
    </div>
  )
}
