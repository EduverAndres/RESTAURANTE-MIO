'use client'

import { LoaderCircleIcon } from 'lucide-react'
import { useRouter } from 'next/navigation'
import { useId, useState, useTransition } from 'react'
import { toast } from 'sonner'
import {
  createCoupon,
  setCouponActive,
} from '@/app/dashboard/fidelidad/actions'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { Switch } from '@/components/ui/switch'
import { formatCOP } from '@/lib/format'

export interface CouponListItem {
  id: string
  code: string
  kind: 'percent' | 'fixed'
  value: number
  min_order: number
  starts_at: string | null
  ends_at: string | null
  max_uses: number | null
  active: boolean
  uses: number
}

function describe(
  coupon: Pick<CouponListItem, 'kind' | 'value' | 'min_order'>,
) {
  const amount =
    coupon.kind === 'percent' ? `${coupon.value} %` : formatCOP(coupon.value)
  return coupon.min_order > 0
    ? `${amount} desde ${formatCOP(coupon.min_order)}`
    : amount
}

/** The store's coupons: create one, see how often each was used, pause it. */
export function CouponsManager({
  storeId,
  coupons,
}: {
  storeId: string
  coupons: CouponListItem[]
}) {
  const router = useRouter()
  const ids = {
    code: useId(),
    kind: useId(),
    value: useId(),
    min: useId(),
    starts: useId(),
    ends: useId(),
    max: useId(),
  }
  const [code, setCode] = useState('')
  const [kind, setKind] = useState<'percent' | 'fixed'>('percent')
  const [value, setValue] = useState(10)
  const [minOrder, setMinOrder] = useState(0)
  const [startsAt, setStartsAt] = useState('')
  const [endsAt, setEndsAt] = useState('')
  const [maxUses, setMaxUses] = useState('')
  const [pending, startTransition] = useTransition()

  function onCreate(event: React.FormEvent<HTMLFormElement>) {
    event.preventDefault()
    startTransition(async () => {
      const result = await createCoupon(storeId, {
        code,
        kind,
        value,
        minOrder,
        startsAt: startsAt || null,
        endsAt: endsAt || null,
        maxUses: maxUses === '' ? null : Number(maxUses),
      })
      if (!result.ok) {
        toast.error(result.error)
        return
      }
      toast.success('Cupón creado.')
      setCode('')
      router.refresh()
    })
  }

  function toggle(coupon: CouponListItem, active: boolean) {
    startTransition(async () => {
      const result = await setCouponActive(coupon.id, active)
      if (!result.ok) toast.error(result.error)
      router.refresh()
    })
  }

  return (
    <div className="space-y-6">
      <form onSubmit={onCreate} className="space-y-4">
        <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
          <div className="space-y-1.5">
            <Label htmlFor={ids.code}>Código</Label>
            <Input
              id={ids.code}
              value={code}
              onChange={(event) => setCode(event.target.value)}
              placeholder="BIENVENIDO10"
              className="font-mono uppercase"
              required
            />
          </div>
          <div className="space-y-1.5">
            <Label htmlFor={ids.kind}>Tipo</Label>
            <select
              id={ids.kind}
              value={kind}
              onChange={(event) =>
                setKind(event.target.value === 'fixed' ? 'fixed' : 'percent')
              }
              className="border-input bg-background rounded-control h-9 w-full border px-2 text-sm"
            >
              <option value="percent">Porcentaje</option>
              <option value="fixed">Valor fijo</option>
            </select>
          </div>
          <div className="space-y-1.5">
            <Label htmlFor={ids.value}>
              {kind === 'percent' ? 'Porcentaje' : 'Valor en pesos'}
            </Label>
            <Input
              id={ids.value}
              type="number"
              min={1}
              value={value}
              onChange={(event) => setValue(Number(event.target.value))}
              className="tabular-nums"
            />
          </div>
          <div className="space-y-1.5">
            <Label htmlFor={ids.min}>Pedido mínimo</Label>
            <Input
              id={ids.min}
              type="number"
              min={0}
              step={1000}
              value={minOrder}
              onChange={(event) => setMinOrder(Number(event.target.value))}
              className="tabular-nums"
            />
          </div>
          <div className="space-y-1.5">
            <Label htmlFor={ids.starts}>Desde (opcional)</Label>
            <Input
              id={ids.starts}
              type="date"
              value={startsAt}
              onChange={(event) => setStartsAt(event.target.value)}
            />
          </div>
          <div className="space-y-1.5">
            <Label htmlFor={ids.ends}>Hasta (opcional)</Label>
            <Input
              id={ids.ends}
              type="date"
              value={endsAt}
              onChange={(event) => setEndsAt(event.target.value)}
            />
          </div>
          <div className="space-y-1.5">
            <Label htmlFor={ids.max}>Usos máximos (opcional)</Label>
            <Input
              id={ids.max}
              type="number"
              min={1}
              value={maxUses}
              onChange={(event) => setMaxUses(event.target.value)}
              className="tabular-nums"
            />
          </div>
        </div>
        <p className="text-muted-foreground text-sm">
          Cada cliente puede usar un cupón una vez. El descuento lo pagas tú y
          la comisión se calcula sobre lo que el cliente paga.
        </p>
        <Button type="submit" disabled={pending} className="rounded-pill">
          {pending ? (
            <LoaderCircleIcon aria-hidden="true" className="animate-spin" />
          ) : null}
          Crear cupón
        </Button>
      </form>

      {coupons.length > 0 ? (
        <ul className="divide-border border-border rounded-card divide-y border">
          {coupons.map((coupon) => (
            <li
              key={coupon.id}
              className="flex flex-wrap items-center justify-between gap-3 p-4"
            >
              <div className="min-w-0 space-y-0.5">
                <p className="font-mono font-semibold">{coupon.code}</p>
                <p className="text-muted-foreground text-sm">
                  {describe(coupon)} · {coupon.uses}
                  {coupon.max_uses ? ` de ${coupon.max_uses}` : ''} usos
                  {coupon.ends_at ? ` · hasta ${coupon.ends_at}` : ''}
                </p>
              </div>
              <label className="flex items-center gap-2 text-sm">
                <Switch
                  checked={coupon.active}
                  onCheckedChange={(checked) => toggle(coupon, checked)}
                  aria-label={`Cupón ${coupon.code} activo`}
                />
                {coupon.active ? 'Activo' : 'Pausado'}
              </label>
            </li>
          ))}
        </ul>
      ) : (
        <p className="text-muted-foreground text-sm">
          Todavía no tienes cupones. Crea uno para tu próxima promoción en
          Instagram o en tu WhatsApp.
        </p>
      )}
    </div>
  )
}
