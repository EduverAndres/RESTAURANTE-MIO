'use client'

import { MoonIcon, SunIcon } from 'lucide-react'
import { useTheme } from 'next-themes'
import { useEffect, useState } from 'react'
import { Button } from '@/components/ui/button'
import { cn } from '@/lib/utils'

export function ThemeToggle({ className }: { className?: string }) {
  const { resolvedTheme, setTheme } = useTheme()
  // The resolved theme is only known on the client, so render a neutral
  // placeholder during SSR to avoid a hydration mismatch.
  const [mounted, setMounted] = useState(false)
  useEffect(() => setMounted(true), [])

  const isDark = mounted && resolvedTheme === 'dark'

  return (
    <Button
      type="button"
      variant="ghost"
      size="icon"
      aria-label="Cambiar tema"
      title="Cambiar tema"
      onClick={() => setTheme(isDark ? 'light' : 'dark')}
      className={cn('rounded-pill', className)}
    >
      {mounted ? (
        isDark ? (
          <SunIcon aria-hidden="true" />
        ) : (
          <MoonIcon aria-hidden="true" />
        )
      ) : (
        <span aria-hidden="true" className="size-4" />
      )}
    </Button>
  )
}
