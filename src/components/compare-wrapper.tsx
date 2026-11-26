'use client'

import Link from 'next/link'
import { ShoppingCart, Star, X } from 'lucide-react'
import { OptimizedImage } from './ui/optimized-image'
import {
  formatCentsAsDollars,
  getProductImages,
  getProductTotalAvailableStock,
} from '../lib/utils/products'
import { Button } from './ui/button'
import { Product } from '@/payload-types'

interface CompareWrapperProps {
  compareItems: Product[]
  isOpen: boolean
  onClose: () => void
  onAddToCart: (product: Product) => void
}

const CompareWrapper = ({ compareItems, isOpen, onClose, onAddToCart }: CompareWrapperProps) => {
  return (
    <section className="compare" aria-hidden={!isOpen} aria-label="Product comparison overlay">
      {compareItems.map((product) => {
        const totalAvail = getProductTotalAvailableStock(product)
        return (
          <div key={product.id} className="compare__item">
            <div className="compare__effect">
              <div className="w-40 h-40 flex items-center justify-center rounded-md bg-secondary border border-border">
                <OptimizedImage
                  src={getProductImages(product)[0]}
                  alt={product.title}
                  width={180}
                  height={180}
                  className="h-full w-full object-cover rounded-md"
                />
              </div>
              <Link
                href={`/products/${product.slug}`}
                className="hover:underline"
                onClick={onClose}
              >
                <h3 className="meta__title">{product.title}</h3>
              </Link>
              <span className="meta__brand">{product.brand}</span>
              <span className="meta__price">{formatCentsAsDollars(product.price)}</span>
              <span className="meta__subcategory">{product.subcategory}</span>
              <span className="meta__material">{product.material}</span>
              <span className="meta__fit">{product.fit}</span>
              <span className="meta__care">{product.care}</span>
              <span className="meta__units">{totalAvail} units available</span>
              <span className="inline-flex items-center justify-center gap-1 text-xs text-amber-400 py-2">
                <Star className="h-3.5 w-3.5 fill-amber-400" aria-hidden="true" />
                {(product.averageRating ?? 0).toFixed(1)} ({product.reviewCount ?? 0} reviews)
              </span>
              <Button type="button" onClick={() => onAddToCart(product)} disabled={totalAvail <= 0}>
                <ShoppingCart className="h-4 w-4" aria-hidden="true" />
                <span>{totalAvail > 0 ? 'Add to cart' : 'Out of Stock'}</span>
              </Button>
            </div>
          </div>
        )
      })}
      <Button
        type="button"
        className="absolute top-3 right-3"
        onClick={onClose}
        aria-label="Close comparison overlay"
        variant="outline"
        size="icon"
      >
        <X className="h-5 w-5" aria-hidden="true" />
        <span className="sr-only">Close comparison overlay</span>
      </Button>
    </section>
  )
}

export default CompareWrapper
