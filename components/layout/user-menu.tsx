'use client'

import { LogOutIcon, UserRoundIcon } from 'lucide-react'
import Link from 'next/link'
import { Avatar, AvatarFallback, AvatarImage } from '@/components/ui/avatar'
import { Button } from '@/components/ui/button'
import { initialsOf } from '@/lib/format'
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuLabel,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from '@/components/ui/dropdown-menu'
import { ROLE_LABELS } from '@/lib/orders/status'
import type { UserRole } from '@/types/app'

export interface UserMenuProps {
  name: string
  email: string
  role: UserRole
  avatarUrl: string | null
}

const ROLE_LINKS: Partial<Record<UserRole, { href: string; label: string }>> = {
  merchant: { href: '/dashboard', label: 'Mi restaurante' },
  courier: { href: '/courier', label: 'Mis entregas' },
  admin: { href: '/admin', label: 'Administración' },
}

export function UserMenu({ name, email, role, avatarUrl }: UserMenuProps) {
  const roleLink = ROLE_LINKS[role]

  return (
    <DropdownMenu>
      <DropdownMenuTrigger asChild>
        <Button
          variant="ghost"
          size="icon-lg"
          className="rounded-pill"
          aria-label="Abrir menú de cuenta"
        >
          <Avatar className="size-8">
            {avatarUrl ? <AvatarImage src={avatarUrl} alt="" /> : null}
            <AvatarFallback className="bg-primary/12 text-primary text-xs font-semibold">
              {initialsOf(name)}
            </AvatarFallback>
          </Avatar>
        </Button>
      </DropdownMenuTrigger>
      <DropdownMenuContent align="end" className="w-60 rounded-2xl p-1.5">
        <DropdownMenuLabel className="space-y-0.5">
          <p className="truncate text-sm font-medium">{name}</p>
          <p className="text-muted-foreground truncate text-xs font-normal">
            {email}
          </p>
          <p className="text-muted-foreground text-xs font-normal">
            {ROLE_LABELS[role]}
          </p>
        </DropdownMenuLabel>
        <DropdownMenuSeparator />
        <DropdownMenuItem asChild>
          <Link href="/account">
            <UserRoundIcon aria-hidden="true" />
            Mi cuenta
          </Link>
        </DropdownMenuItem>
        {roleLink ? (
          <DropdownMenuItem asChild>
            <Link href={roleLink.href}>{roleLink.label}</Link>
          </DropdownMenuItem>
        ) : null}
        <DropdownMenuSeparator />
        <form action="/auth/sign-out" method="post">
          <DropdownMenuItem asChild>
            <button type="submit" className="w-full">
              <LogOutIcon aria-hidden="true" />
              Cerrar sesión
            </button>
          </DropdownMenuItem>
        </form>
      </DropdownMenuContent>
    </DropdownMenu>
  )
}
