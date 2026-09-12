'use client'

import { MoonIcon, SunIcon } from 'lucide-react'
import { useEffect, useState } from 'react'

type Scheme = 'auto' | 'light' | 'dark'

const NEXT: Record<Scheme, Scheme> = {
  auto: 'dark',
  dark: 'light',
  light: 'auto',
}

const LABEL: Record<Scheme, string> = {
  auto: 'Tema automático',
  light: 'Tema claro',
  dark: 'Tema oscuro',
}

interface SchemeToggleProps {
  storeSlug: string
  className?: string
}

/**
 * Offered only when the merchant picked `mode: "auto"`, i.e. they explicitly
 * said the storefront should follow the visitor. The choice is written on the
 * `[data-store-theme]` wrapper — `globals.css` swaps the neutrals there and
 * leaves the brand colours exactly as the merchant set them — and remembered
 * per store, because a visitor's preference for one shop says nothing about
 * another's.
 */
export function SchemeToggle({ storeSlug, className }: SchemeToggleProps) {
  const key = `tienda-scheme:${storeSlug}`
  const [scheme, setScheme] = useState<Scheme>('auto')

  useEffect(() => {
    const stored = window.localStorage.getItem(key)
    if (stored === 'light' || stored === 'dark') setScheme(stored)
  }, [key])

  useEffect(() => {
    const root = document.querySelector<HTMLElement>('[data-store-theme]')
    if (!root) return
    root.dataset.storeScheme = scheme
    if (scheme === 'auto') window.localStorage.removeItem(key)
    else window.localStorage.setItem(key, scheme)
  }, [scheme, key])

  return (
    <button
      type="button"
      onClick={() => setScheme((current) => NEXT[current])}
      aria-label={`${LABEL[scheme]}. Cambiar a ${LABEL[NEXT[scheme]].toLowerCase()}`}
      className={
        className ??
        'inline-flex size-9 items-center justify-center rounded-full bg-[rgb(var(--store-text-rgb)/0.07)] text-[var(--store-text)] transition-colors hover:bg-[rgb(var(--store-text-rgb)/0.14)]'
      }
    >
      {scheme === 'dark' ? (
        <MoonIcon aria-hidden="true" className="size-4" />
      ) : (
        <SunIcon aria-hidden="true" className="size-4" />
      )}
    </button>
  )
}
