import { ShoppingBag } from 'lucide-react'
import { Empty, EmptyDescription, EmptyHeader, EmptyMedia, EmptyTitle } from '../ui/empty'

export function CartEmptyState() {
  return (
    <div className="flex flex-1 items-center justify-center p-6">
      <Empty>
        <EmptyHeader>
          <EmptyMedia
            variant="icon"
            className="size-16 rounded-full border border-dashed border-border bg-secondary text-primary [&_svg:not([class*='size-'])]:size-7"
          >
            <ShoppingBag aria-hidden="true" />
          </EmptyMedia>
          <EmptyTitle className="text-lg font-bold">Your cart is empty</EmptyTitle>
          <EmptyDescription>
            Explore our collection of jackets, shirts, dresses, trousers, and shoes to add items to
            your bag.
          </EmptyDescription>
        </EmptyHeader>
      </Empty>
    </div>
  )
}
