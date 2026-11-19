import { Skeleton } from '../ui/skeleton'

export function GridSkeleton() {
  return (
    <div
      className="mx-auto grid max-w-[1300px] grid-cols-1 gap-4 px-3 py-5 sm:grid-cols-2 md:grid-cols-3 lg:grid-cols-5"
      role="status"
      aria-label="Loading products"
    >
      {Array.from({ length: 10 }).map((_, idx) => (
        <div
          key={`grid-skeleton-${idx}`}
          className="rounded-lg border border-border bg-card p-3 text-left"
        >
          <Skeleton className="aspect-square w-full rounded-lg" />
          <Skeleton className="mt-3 h-4 w-3/4" />
          <Skeleton className="mt-1.5 h-3 w-1/2" />
          <div className="mt-2.5 flex items-center justify-between">
            <Skeleton className="h-3.5 w-16" />
            <Skeleton className="h-4 w-12" />
          </div>
        </div>
      ))}
    </div>
  )
}
