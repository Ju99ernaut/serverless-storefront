'use client'

import Link from 'next/link'
import { Heart, ShoppingCart, Trash2 } from 'lucide-react'
import { getProductImages, type Product } from '@/data/utils'
import { Button, buttonVariants } from '../ui/button'
import { Card, CardContent } from '../ui/card'
import {
  Empty,
  EmptyContent,
  EmptyDescription,
  EmptyHeader,
  EmptyMedia,
  EmptyTitle,
} from '../ui/empty'
import { OptimizedImage } from '../ui/optimized-image'

interface AccountWishlistTabProps {
  lovedProducts: Product[]
  onAddToCart: (product: Product) => void
  onToggleWishlist: (product: Product) => void
}

export function AccountWishlistTab({
  lovedProducts,
  onAddToCart,
  onToggleWishlist,
}: AccountWishlistTabProps) {
  if (lovedProducts.length === 0) {
    return (
      <Card>
        <CardContent className="p-6">
          <Empty>
            <EmptyHeader>
              <EmptyMedia variant="icon">
                <Heart aria-hidden="true" />
              </EmptyMedia>
              <EmptyTitle>No loved items saved yet</EmptyTitle>
              <EmptyDescription>
                Tap the heart icon on any piece in the catalog to save it here.
              </EmptyDescription>
            </EmptyHeader>
            <EmptyContent>
              <Link className={buttonVariants({ size: 'sm' })} href="/">
                Discover Clothing Pieces
              </Link>
            </EmptyContent>
          </Empty>
        </CardContent>
      </Card>
    )
  }

  return (
    <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4">
      {lovedProducts.map((item) => (
        <Card key={item.id}>
          <CardContent className="p-4 flex flex-col gap-3">
            <Link
              href={`/products/${item.slug}`}
              className="flex h-40 items-center justify-center rounded-none bg-secondary p-3"
            >
              <OptimizedImage
                src={getProductImages(item)[0]}
                alt={item.title}
                width={160}
                height={160}
                className="max-h-full w-auto object-contain"
              />
            </Link>
            <div>
              <Link
                href={`/products/${item.slug}`}
                className="font-bold text-sm text-foreground hover:text-primary"
              >
                {item.title}
              </Link>
              <div className="text-xs text-muted-foreground">
                {item.brand} &bull; ${item.price}
              </div>
            </div>
            <div className="flex items-center gap-2 pt-1">
              <Button
                type="button"
                size="sm"
                className="flex-1 gap-1.5"
                onClick={() => onAddToCart(item)}
              >
                <ShoppingCart className="h-3.5 w-3.5" aria-hidden="true" />
                <span>Add to Bag</span>
              </Button>
              <Button
                type="button"
                size="icon"
                variant="outline"
                aria-label={`Remove ${item.title} from loved items`}
                onClick={() => onToggleWishlist(item)}
              >
                <Trash2 className="h-4 w-4 text-rose-500" />
              </Button>
            </div>
          </CardContent>
        </Card>
      ))}
    </div>
  )
}
