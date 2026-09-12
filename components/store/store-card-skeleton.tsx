import { Skeleton } from '@/components/ui/skeleton'

export function StoreCardSkeleton() {
  return (
    <div
      aria-hidden="true"
      className="rounded-card bg-card shadow-1 overflow-hidden"
    >
      <div className="relative">
        <Skeleton className="aspect-[4/3] w-full rounded-none" />
        {/* The logo medallion, so the card does not jump when it loads. */}
        <Skeleton className="absolute bottom-3 left-4 size-12 rounded-2xl" />
      </div>
      <div className="flex items-center justify-between px-4 py-3">
        <Skeleton className="h-4 w-20" />
        <Skeleton className="h-4 w-14" />
      </div>
    </div>
  )
}

export function StoreGridSkeleton({ count = 6 }: { count?: number }) {
  return (
    <div className="gap-card grid sm:grid-cols-2 lg:grid-cols-3">
      {Array.from({ length: count }, (_, index) => (
        <StoreCardSkeleton key={index} />
      ))}
    </div>
  )
}
