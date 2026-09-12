'use client'

import { useCallback, useEffect, useRef, useState } from 'react'
import { prefersReducedMotion } from '@/lib/store/motion'
import {
  mergeSpyEntries,
  pickActiveSection,
  type SpyEntry,
} from '@/lib/store/scroll-spy'
import { cn } from '@/lib/utils'
import type { ThemeCategoryNav, ThemeMotion } from '@/types/app'

export interface NavCategory {
  id: string
  name: string
}

interface CategoryNavProps {
  categories: NavCategory[]
  variant: ThemeCategoryNav
  motion: ThemeMotion
  className?: string
}

/** The id of the section a category anchor points at. */
export function categorySectionId(categoryId: string): string {
  return `categoria-${categoryId}`
}

/**
 * Sticky category nav with scroll-spy.
 *
 * The observer only collects raw numbers; which category reads as current is
 * decided by `pickActiveSection`, which is a pure function with its own tests.
 * That keeps the one piece of genuinely tricky logic out of the effect.
 */
export function CategoryNav({
  categories,
  variant,
  motion,
  className,
}: CategoryNavProps) {
  const [activeId, setActiveId] = useState<string | null>(
    categories[0]?.id ?? null,
  )
  const entriesRef = useRef<SpyEntry[]>([])
  const activeRef = useRef<string | null>(activeId)
  activeRef.current = activeId

  useEffect(() => {
    entriesRef.current = categories.map((category) => ({
      id: category.id,
      isIntersecting: false,
      top: Number.POSITIVE_INFINITY,
    }))

    const sections = categories
      .map((category) =>
        document.getElementById(categorySectionId(category.id)),
      )
      .filter((element): element is HTMLElement => element !== null)
    if (sections.length === 0) return
    // Without an observer the nav still navigates; it just stops highlighting.
    if (typeof IntersectionObserver === 'undefined') return

    const observer = new IntersectionObserver(
      (observed) => {
        const incoming: SpyEntry[] = observed.map((entry) => ({
          id: entry.target.id.replace('categoria-', ''),
          isIntersecting: entry.isIntersecting,
          top: entry.boundingClientRect.top,
        }))
        entriesRef.current = mergeSpyEntries(entriesRef.current, incoming)
        const next = pickActiveSection(entriesRef.current, activeRef.current)
        if (next !== activeRef.current) setActiveId(next)
      },
      {
        // The top margin matches the sticky stack, so a heading counts as
        // "current" exactly when it slides under the nav.
        rootMargin: '-140px 0px -55% 0px',
        threshold: 0,
      },
    )
    sections.forEach((section) => observer.observe(section))
    return () => observer.disconnect()
  }, [categories])

  const go = useCallback(
    (event: React.MouseEvent<HTMLAnchorElement>, categoryId: string) => {
      const target = document.getElementById(categorySectionId(categoryId))
      if (!target) return
      event.preventDefault()
      setActiveId(categoryId)
      const reduced = motion === 'none' || prefersReducedMotion()
      target.scrollIntoView({
        behavior: reduced ? 'auto' : 'smooth',
        block: 'start',
      })
      // Keep the URL shareable without letting the jump fight the smooth scroll.
      window.history.replaceState(null, '', `#${categorySectionId(categoryId)}`)
    },
    [motion],
  )

  if (categories.length === 0) return null

  const sidebar = variant === 'sidebar'

  return (
    <nav
      aria-label="Categorías del menú"
      className={cn(
        sidebar
          ? 'lg:sticky lg:top-[calc(var(--store-nav-top)+1rem)] lg:self-start'
          : '-mx-gutter px-gutter sticky top-[var(--store-nav-top)] z-30',
        !sidebar &&
          variant === 'sticky-bar' &&
          'shadow-2 bg-[var(--store-primary)] text-[var(--store-on-primary)]',
        !sidebar &&
          variant !== 'sticky-bar' &&
          'border-b border-[rgb(var(--store-text-rgb)/0.08)] bg-[rgb(var(--store-background-rgb)/0.88)] backdrop-blur-md',
        className,
      )}
    >
      <ul
        className={cn(
          sidebar
            ? 'flex [scrollbar-width:none] gap-2 overflow-x-auto py-3 lg:flex-col lg:overflow-visible [&::-webkit-scrollbar]:hidden'
            : 'flex [scrollbar-width:none] gap-2 overflow-x-auto py-3 [&::-webkit-scrollbar]:hidden',
          variant === 'tabs' && 'gap-5',
        )}
      >
        {categories.map((category) => {
          const active = category.id === activeId
          return (
            <li key={category.id} className={cn(!sidebar && 'shrink-0')}>
              <a
                href={`#${categorySectionId(category.id)}`}
                onClick={(event) => go(event, category.id)}
                aria-current={active ? 'true' : undefined}
                className={cn(
                  'inline-flex items-center text-sm font-medium whitespace-nowrap transition-colors',
                  variant === 'tabs' &&
                    cn(
                      'border-b-2 px-0.5 py-1.5',
                      active
                        ? 'border-[var(--store-primary)] text-[var(--store-primary)]'
                        : 'border-transparent text-[rgb(var(--store-text-rgb)/0.65)] hover:text-[var(--store-text)]',
                    ),
                  variant === 'chips' &&
                    cn(
                      'rounded-[var(--store-button-radius)] px-3.5 py-1.5',
                      active
                        ? 'bg-[var(--store-primary)] text-[var(--store-on-primary)]'
                        : 'bg-[rgb(var(--store-text-rgb)/0.06)] hover:bg-[rgb(var(--store-text-rgb)/0.12)]',
                    ),
                  variant === 'sticky-bar' &&
                    cn(
                      'rounded-[var(--store-button-radius)] px-3.5 py-1.5',
                      active
                        ? 'bg-[rgb(var(--store-on-primary-rgb)/0.22)]'
                        : 'opacity-75 hover:opacity-100',
                    ),
                  variant === 'sidebar' &&
                    cn(
                      'w-full rounded-[var(--store-button-radius)] px-3.5 py-2 lg:justify-start',
                      active
                        ? 'bg-[rgb(var(--store-primary-rgb)/0.14)] font-semibold text-[var(--store-primary)]'
                        : 'text-[rgb(var(--store-text-rgb)/0.7)] hover:bg-[rgb(var(--store-text-rgb)/0.06)]',
                    ),
                )}
              >
                {category.name}
              </a>
            </li>
          )
        })}
      </ul>
    </nav>
  )
}
