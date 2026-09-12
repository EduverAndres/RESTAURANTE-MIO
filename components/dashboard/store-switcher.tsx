'use client'

import {
  CheckIcon,
  ChevronsUpDownIcon,
  PlusIcon,
  StoreIcon,
} from 'lucide-react'
import Link from 'next/link'
import { useRouter } from 'next/navigation'
import { useTransition } from 'react'
import { toast } from 'sonner'
import { setActiveStore } from '@/app/dashboard/store-actions'
import { StoreStatusBadge } from '@/components/orders/order-status-badge'
import { Button } from '@/components/ui/button'
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuLabel,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from '@/components/ui/dropdown-menu'
import { cn } from '@/lib/utils'
import type { StoreStatus } from '@/types/app'

export interface StoreSwitcherStore {
  id: string
  name: string
  status: StoreStatus
}

interface StoreSwitcherProps {
  stores: StoreSwitcherStore[]
  activeId: string
  className?: string
}

/**
 * Header control that shows the active store. With a single store it is a
 * static label; with two or more it becomes a dropdown that sets the
 * active-store cookie and refreshes the server tree.
 */
export function StoreSwitcher({
  stores,
  activeId,
  className,
}: StoreSwitcherProps) {
  const router = useRouter()
  const [pending, startTransition] = useTransition()
  const active = stores.find((store) => store.id === activeId) ?? stores[0]
  if (!active) return null

  if (stores.length === 1) {
    return (
      <div
        className={cn('flex min-w-0 items-center gap-2', className)}
        aria-label="Tienda activa"
      >
        <StoreIcon
          aria-hidden="true"
          className="text-primary size-4 shrink-0"
        />
        <span className="truncate text-sm font-medium">{active.name}</span>
        <StoreStatusBadge status={active.status} />
      </div>
    )
  }

  function select(storeId: string) {
    if (storeId === active?.id) return
    startTransition(async () => {
      const result = await setActiveStore(storeId)
      if (!result.ok) {
        toast.error(result.error)
        return
      }
      router.refresh()
    })
  }

  return (
    <DropdownMenu>
      <DropdownMenuTrigger asChild>
        <Button
          variant="outline"
          size="sm"
          disabled={pending}
          aria-label={`Tienda activa: ${active.name}. Cambiar de tienda`}
          className={cn('rounded-pill max-w-56 gap-2', className)}
        >
          <StoreIcon aria-hidden="true" className="text-primary" />
          <span className="truncate">{active.name}</span>
          <StoreStatusBadge
            status={active.status}
            className="hidden sm:inline-flex"
          />
          <ChevronsUpDownIcon aria-hidden="true" className="opacity-60" />
        </Button>
      </DropdownMenuTrigger>
      <DropdownMenuContent align="end" className="w-64">
        <DropdownMenuLabel>Mis tiendas</DropdownMenuLabel>
        {stores.map((store) => (
          <DropdownMenuItem
            key={store.id}
            onSelect={() => select(store.id)}
            className="justify-between gap-2"
          >
            <span className="truncate">{store.name}</span>
            <span className="flex items-center gap-1.5">
              <StoreStatusBadge status={store.status} />
              {store.id === active.id ? (
                <CheckIcon aria-hidden="true" className="text-primary" />
              ) : null}
            </span>
          </DropdownMenuItem>
        ))}
        <DropdownMenuSeparator />
        <DropdownMenuItem asChild>
          <Link href="/dashboard/onboarding">
            <PlusIcon aria-hidden="true" />
            Crear otra tienda
          </Link>
        </DropdownMenuItem>
      </DropdownMenuContent>
    </DropdownMenu>
  )
}
