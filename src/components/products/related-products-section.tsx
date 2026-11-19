import Link from 'next/link'
import { formatCentsAsDollars, getProductImages, type Product } from '@/lib/utils/data'
import { OptimizedImage } from '../ui/optimized-image'

interface RelatedProductsSectionProps {
  relatedProducts: Product[]
}

export function RelatedProductsSection({ relatedProducts }: RelatedProductsSectionProps) {
  if (relatedProducts.length === 0) return null

  return (
    <section className="mt-14 pt-8 border-t border-border">
      <h2 className="text-lg font-bold text-foreground mb-4">Complete the Wardrobe</h2>
      <div className="grid grid-cols-2 sm:grid-cols-4 gap-4">
        {relatedProducts.map((rel) => (
          <Link
            key={rel.id}
            href={`/products/${rel.slug}`}
            className="group rounded-md border border-border bg-card p-4 transition-colors hover:border-primary"
          >
            <div className="flex h-36 items-center justify-center rounded-none bg-secondary p-3">
              <OptimizedImage
                src={getProductImages(rel)[0]}
                alt={rel.title}
                width={160}
                height={160}
                className="max-h-full w-auto object-contain"
              />
            </div>
            <div className="mt-3">
              <div className="text-xs font-bold text-foreground group-hover:text-primary truncate">
                {rel.title}
              </div>
              <div className="mt-0.5 flex items-center justify-between text-xs text-muted-foreground">
                <span>{rel.brand}</span>
                <span className="font-bold text-primary">{formatCentsAsDollars(rel.price)}</span>
              </div>
            </div>
          </Link>
        ))}
      </div>
    </section>
  )
}
