import { SearchX } from 'lucide-react'
import { Empty, EmptyDescription, EmptyHeader, EmptyMedia, EmptyTitle } from '../ui/empty'

export function GridEmptyState() {
  return (
    <div className="mx-auto my-12 max-w-md px-4">
      <Empty className="border border-border bg-card">
        <EmptyHeader>
          <EmptyMedia variant="icon">
            <SearchX aria-hidden="true" />
          </EmptyMedia>
          <EmptyTitle>No matching clothing items found</EmptyTitle>
          <EmptyDescription>
            Try clearing your search term or selecting another category filter.
          </EmptyDescription>
        </EmptyHeader>
      </Empty>
    </div>
  )
}
