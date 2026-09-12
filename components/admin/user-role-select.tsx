'use client'

import { useRouter } from 'next/navigation'
import { useTransition } from 'react'
import { toast } from 'sonner'
import { setUserRole } from '@/app/admin/actions'
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select'
import { USER_ROLES } from '@/lib/auth/roles'
import { ROLE_LABELS } from '@/lib/orders/status'
import type { UserRole } from '@/types/app'

interface UserRoleSelectProps {
  userId: string
  role: UserRole
  userName: string
  /** The signed-in admin cannot change their own role. */
  disabled?: boolean
}

export function UserRoleSelect({
  userId,
  role,
  userName,
  disabled = false,
}: UserRoleSelectProps) {
  const router = useRouter()
  const [pending, startTransition] = useTransition()

  function onChange(value: string) {
    startTransition(async () => {
      const result = await setUserRole(userId, value as UserRole)
      if (!result.ok) {
        toast.error(result.error)
        return
      }
      toast.success('Rol actualizado.')
      router.refresh()
    })
  }

  return (
    <Select value={role} onValueChange={onChange} disabled={disabled || pending}>
      <SelectTrigger
        aria-label={`Rol de ${userName}`}
        className="rounded-control h-9 w-40"
      >
        <SelectValue />
      </SelectTrigger>
      <SelectContent>
        {USER_ROLES.map((option) => (
          <SelectItem key={option} value={option}>
            {ROLE_LABELS[option]}
          </SelectItem>
        ))}
      </SelectContent>
    </Select>
  )
}
