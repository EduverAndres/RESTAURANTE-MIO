'use client'

import { ExternalLinkIcon } from 'lucide-react'
import Link from 'next/link'
import { useRouter } from 'next/navigation'
import { useState, useTransition } from 'react'
import { toast } from 'sonner'
import { setStoreOpen } from './actions'
import { StoreStatusBadge } from '@/components/orders/order-status-badge'
import { Label } from '@/components/ui/label'
import { Switch } from '@/components/ui/switch'
import { env } from '@/lib/env'
import { storePublicUrl } from '@/lib/subdomain'
import type { StoreStatus } from '@/types/app'

interface StoreStatusCardProps {
  storeId: string
  slug: string
  status: StoreStatus
  isOpen: boolean
}

const STATUS_HELP: Record<StoreStatus, string> = {
  pending:
    'Un administrador revisará tu tienda antes de publicarla. Mientras tanto puedes armar tu carta.',
  active: 'Tu tienda es visible para los clientes.',
  suspended: 'Tu tienda fue suspendida. Escríbenos para revisar el caso.',
}

export function StoreStatusCard({
  storeId,
  slug,
  status,
  isOpen,
}: StoreStatusCardProps) {
  const router = useRouter()
  const [open, setOpen] = useState(isOpen)
  const [pending, startTransition] = useTransition()

  function toggle(next: boolean) {
    const previous = open
    setOpen(next)
    startTransition(async () => {
      const result = await setStoreOpen(storeId, next)
      if (!result.ok) {
        setOpen(previous)
        toast.error(result.error)
        return
      }
      toast.success(next ? 'Tienda abierta.' : 'Tienda pausada.')
      router.refresh()
    })
  }

  return (
    <section
      aria-labelledby="store-status-title"
      className="rounded-card border-border bg-card shadow-soft space-y-4 border p-5"
    >
      <div className="flex items-start justify-between gap-3">
        <h2
          id="store-status-title"
          className="font-display text-xl font-semibold"
        >
          Estado
        </h2>
        <StoreStatusBadge status={status} />
      </div>
      <p className="text-muted-foreground text-sm">{STATUS_HELP[status]}</p>

      <div className="rounded-control bg-muted/60 flex items-center justify-between gap-3 px-3 py-2.5">
        <div>
          <Label htmlFor="store-open" className="text-sm">
            {open ? 'Recibiendo pedidos' : 'Pausada'}
          </Label>
          <p className="text-muted-foreground text-xs">
            Pausa la tienda para dejar de recibir pedidos temporalmente.
          </p>
        </div>
        <Switch
          id="store-open"
          checked={open}
          disabled={pending}
          onCheckedChange={toggle}
        />
      </div>

      <Link
        href={storePublicUrl({
          slug,
          siteUrl: env.NEXT_PUBLIC_SITE_URL,
          rootDomain: env.NEXT_PUBLIC_ROOT_DOMAIN,
        })}
        target="_blank"
        rel="noreferrer"
        className="text-primary inline-flex items-center gap-1.5 text-sm font-medium underline-offset-4 hover:underline"
      >
        Ver tienda pública
        <ExternalLinkIcon aria-hidden="true" className="size-3.5" />
      </Link>
    </section>
  )
}
