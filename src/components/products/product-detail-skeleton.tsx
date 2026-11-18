import { Skeleton } from '../ui/skeleton'

export function ProductDetailSkeleton() {
  return (
    <div
      className="grid grid-cols-1 gap-8 lg:grid-cols-12"
      aria-busy="true"
      aria-label="Loading garment details"
    >
      <div className="space-y-4 lg:col-span-6">
        <Skeleton className="h-[380px] w-full rounded-md sm:h-[460px]" />
        <div className="grid grid-cols-4 gap-3">
          {Array.from({ length: 4 }).map((_, idx) => (
            <Skeleton key={`thumb-skeleton-${idx}`} className="h-20 w-full rounded-md" />
          ))}
        </div>
      </div>

      <div className="space-y-6 lg:col-span-6">
        <div className="space-y-3">
          <Skeleton className="h-4 w-36" />
          <Skeleton className="h-9 w-3/4" />
          <div className="flex items-center gap-4 pt-1">
            <Skeleton className="h-7 w-24" />
            <Skeleton className="h-5 w-32" />
          </div>
          <div className="space-y-2 pt-2">
            <Skeleton className="h-4 w-full" />
            <Skeleton className="h-4 w-5/6" />
          </div>
        </div>

        <div className="space-y-2.5">
          <Skeleton className="h-4 w-20" />
          <div className="flex gap-2.5">
            <Skeleton className="h-9 w-24" />
            <Skeleton className="h-9 w-24" />
            <Skeleton className="h-9 w-24" />
          </div>
        </div>

        <div className="space-y-2.5">
          <Skeleton className="h-4 w-28" />
          <div className="flex gap-2">
            <Skeleton className="h-9 w-12" />
            <Skeleton className="h-9 w-12" />
            <Skeleton className="h-9 w-12" />
            <Skeleton className="h-9 w-12" />
          </div>
        </div>

        <div className="flex items-center gap-3 pt-4">
          <Skeleton className="h-9 w-28" />
          <Skeleton className="h-9 flex-1" />
          <Skeleton className="h-9 w-10" />
        </div>

        <div className="grid grid-cols-1 gap-3 pt-2 sm:grid-cols-3">
          <Skeleton className="h-16 w-full rounded-md" />
          <Skeleton className="h-16 w-full rounded-md" />
          <Skeleton className="h-16 w-full rounded-md" />
        </div>
      </div>
    </div>
  )
}
