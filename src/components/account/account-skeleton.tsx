import { Card, CardContent } from '../ui/card'
import { Skeleton } from '../ui/skeleton'

export function AccountSkeleton() {
  return (
    <div className="space-y-8" aria-busy="true" aria-label="Loading account portal">
      <div className="flex flex-col md:flex-row md:items-center justify-between gap-4 border border-border bg-card p-6">
        <div className="flex items-center gap-4">
          <Skeleton className="h-14 w-14 rounded-full" />
          <div className="space-y-2">
            <Skeleton className="h-5 w-40" />
            <Skeleton className="h-4 w-52" />
          </div>
        </div>
        <div className="grid grid-cols-3 gap-3">
          <Skeleton className="h-16 w-20" />
          <Skeleton className="h-16 w-20" />
          <Skeleton className="h-16 w-20" />
        </div>
      </div>

      <div className="flex flex-wrap gap-2">
        <Skeleton className="h-9 w-36" />
        <Skeleton className="h-9 w-32" />
        <Skeleton className="h-9 w-28" />
        <Skeleton className="h-9 w-36" />
      </div>

      <Card>
        <CardContent className="p-6 space-y-4">
          <Skeleton className="h-6 w-48" />
          <Skeleton className="h-24 w-full" />
          <Skeleton className="h-24 w-full" />
        </CardContent>
      </Card>
    </div>
  )
}
