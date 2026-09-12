import { Skeleton } from '@/components/ui/skeleton'

export function StoreCardSkeleton() {
  return (
    <div
      aria-hidden="true"
      className="rounded-card bg-card shadow-soft ring-foreground/5 overflow-hidden ring-1"
    >
      <Skeleton className="aspect-[4/3] w-full rounded-none" />
      <div className="flex items-center justify-between px-4 py-3">
        <Skeleton className="h-4 w-20" />
        <Skeleton className="h-4 w-14" />
      </div>
    </div>
  )
}

export function StoreGridSkeleton({ count = 6 }: { count?: number }) {
  return (
    <div className="grid gap-5 sm:grid-cols-2 lg:grid-cols-3">
      {Array.from({ length: count }, (_, index) => (
        <StoreCardSkeleton key={index} />
      ))}
    </div>
  )
}
