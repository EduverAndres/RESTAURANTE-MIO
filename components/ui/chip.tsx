'use client'

import { cva, type VariantProps } from 'class-variance-authority'
import { cn } from '@/lib/utils'
import { Icon, CategoryIcons, type LucideIconName, type TablerIconName } from './icon'
import { forwardRef } from 'react'

const chipVariants = cva(
  [
    'inline-flex items-center gap-1.5',
    'font-ui font-medium',
    'rounded-chip',
    'transition-all duration-fast ease-out',
    'focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2',
  ],
  {
    variants: {
      variant: {
        default: 'bg-muted text-muted-foreground hover:bg-muted/80',
        primary: 'bg-primary/10 text-primary hover:bg-primary/20',
        success: 'bg-success/10 text-success hover:bg-success/20',
        warning: 'bg-warning/10 text-warning hover:bg-warning/20',
        error: 'bg-error/10 text-error hover:bg-error/20',
        outline: 'border-2 border-border bg-transparent hover:bg-muted',
        ghost: 'bg-transparent hover:bg-muted',
        selected: 'bg-primary text-primary-foreground shadow-[var(--shadow-primary)]',
      },
      size: {
        xs: 'px-2 py-0.5 text-micro gap-1',
        sm: 'px-3 py-1 text-caption',
        md: 'px-4 py-1.5 text-body-sm',
        lg: 'px-5 py-2 text-body',
      },
      removable: {
        true: 'pr-1',
        false: '',
      },
    },
    defaultVariants: {
      variant: 'default',
      size: 'sm',
      removable: false,
    },
  }
)

interface ChipProps
  extends React.ButtonHTMLAttributes<HTMLButtonElement>,
    VariantProps<typeof chipVariants> {
  icon?: LucideIconName | TablerIconName
  iconSet?: 'lucide' | 'tabler'
  category?: keyof typeof CategoryIcons
  onRemove?: () => void
  removable?: boolean
  selected?: boolean
}

export const Chip = forwardRef<HTMLButtonElement, ChipProps>(
  ({ className, variant, size, icon, iconSet = 'lucide', category, onRemove, removable, selected, children, disabled, ...props }, ref) => {
    const isSelected = selected || variant === 'selected'
    const effectiveVariant = isSelected ? 'selected' : variant

    return (
      <button
        ref={ref}
        className={cn(chipVariants({ variant: effectiveVariant, size, removable }), className)}
        disabled={disabled}
        aria-pressed={isSelected}
        type={props.type || 'button'}
        {...props}
      >
        {category && (
          <Icon
            name={CategoryIcons[category].name}
            set={CategoryIcons[category].set}
            size={size === 'xs' ? 'xs' : size === 'sm' ? 'sm' : 'md'}
            aria-hidden={true}
          />
        )}
        {icon && !category && (
          <Icon name={icon} set={iconSet} size={size === 'xs' ? 'xs' : size === 'sm' ? 'sm' : 'md'} aria-hidden={true} />
        )}
        {children}
        {removable && onRemove && (
          <button
            type="button"
            className="ml-1 inline-flex items-center justify-center size-5 rounded-full hover:bg-black/10 hover:bg-white/10 transition-colors"
            onClick={(e) => { e.stopPropagation(); onRemove(); }}
            aria-label="Eliminar"
          >
            <Icon name="X" set="lucide" size="xs" />
          </button>
        )}
      </button>
    )
  }
)
Chip.displayName = 'Chip'

/* Filter chips específicos para el marketplace */
export const FilterChips = {
  openNow: { label: 'Abierto ahora', icon: 'Clock', variant: 'default' as const },
  freeDelivery: { label: 'Envío gratis', icon: 'Truck', variant: 'default' as const },
  topRated: { label: 'Mejor calificados', icon: 'Star', variant: 'default' as const },
  fastest: { label: 'Más rápido', icon: 'Zap', variant: 'default' as const },
  offers: { label: 'Ofertas', icon: 'Tag', variant: 'default' as const },
} as const

export function FilterChip({
  filter,
  active,
  onToggle,
}: {
  filter: keyof typeof FilterChips
  active: boolean
  onToggle: (filter: keyof typeof FilterChips) => void
}) {
  const config = FilterChips[filter]
  return (
    <Chip
      variant={active ? 'selected' : 'outline'}
      icon={config.icon}
      onClick={() => onToggle(filter)}
      className="whitespace-nowrap"
    >
      {config.label}
    </Chip>
  )
}