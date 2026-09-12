'use client'

import { useEffect, useState } from 'react'
import { cn } from '@/lib/utils'

interface CategoryNavProps {
  categories: { id: string; name: string }[]
}

/** Sticky horizontal anchor nav that highlights the category in view. */
export function CategoryNav({ categories }: CategoryNavProps) {
  const [activeId, setActiveId] = useState<string | null>(
    categories[0]?.id ?? null,
  )

  useEffect(() => {
    const sections = categories
      .map((category) => document.getElementById(`categoria-${category.id}`))
      .filter((element): element is HTMLElement => element !== null)
    if (sections.length === 0) return

    const observer = new IntersectionObserver(
      (entries) => {
        const visible = entries
          .filter((entry) => entry.isIntersecting)
          .sort((a, b) => a.boundingClientRect.top - b.boundingClientRect.top)
        if (visible[0]) {
          setActiveId(visible[0].target.id.replace('categoria-', ''))
        }
      },
      { rootMargin: '-120px 0px -60% 0px', threshold: 0 },
    )
    sections.forEach((section) => observer.observe(section))
    return () => observer.disconnect()
  }, [categories])

  if (categories.length === 0) return null

  return (
    <nav
      aria-label="Categorías del menú"
      className="sticky top-16 z-30 -mx-4 border-b border-[rgb(var(--store-text-rgb)/0.08)] bg-[rgb(var(--store-background-rgb)/0.85)] px-4 backdrop-blur-md sm:-mx-6 sm:px-6 lg:-mx-8 lg:px-8"
    >
      <ul className="flex [scrollbar-width:none] gap-2 overflow-x-auto py-3 [&::-webkit-scrollbar]:hidden">
        {categories.map((category) => {
          const active = category.id === activeId
          return (
            <li key={category.id} className="shrink-0">
              <a
                href={`#categoria-${category.id}`}
                aria-current={active ? 'true' : undefined}
                className={cn(
                  'inline-flex items-center rounded-[var(--store-button-radius)] px-3.5 py-1.5 text-sm font-medium transition-colors',
                  active
                    ? 'bg-[var(--store-primary)] text-white'
                    : 'bg-[rgb(var(--store-text-rgb)/0.06)] text-[var(--store-text)] hover:bg-[rgb(var(--store-text-rgb)/0.12)]',
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
