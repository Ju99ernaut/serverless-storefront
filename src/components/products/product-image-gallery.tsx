'use client'

import { useEffect, useState } from 'react'
import { AlertTriangle, CheckCircle2 } from 'lucide-react'
import { cn } from 'cn'
import { Badge } from '../ui/badge'
import {
  Carousel,
  CarouselContent,
  CarouselItem,
  CarouselNext,
  CarouselPrevious,
  type CarouselApi,
} from '../ui/carousel'
import { OptimizedImage } from '../ui/optimized-image'

interface ProductImageGalleryProps {
  productId: string
  productTitle: string
  galleryImages: string[]
  activeVariantImageUrl?: string
  isOutOfStock: boolean
  isLowStock: boolean
  availableStock: number
}

export function ProductImageGallery({
  productId,
  productTitle,
  galleryImages,
  activeVariantImageUrl,
  isOutOfStock,
  isLowStock,
  availableStock,
}: ProductImageGalleryProps) {
  const [activeImageIndex, setActiveImageIndex] = useState(0)
  const [carouselApi, setCarouselApi] = useState<CarouselApi>()

  useEffect(() => {
    if (!carouselApi) return
    const onSelect = () => {
      setActiveImageIndex(carouselApi.selectedScrollSnap())
    }
    onSelect()
    carouselApi.on('select', onSelect)
    carouselApi.on('reInit', onSelect)
    return () => {
      carouselApi.off('select', onSelect)
      carouselApi.off('reInit', onSelect)
    }
  }, [carouselApi])

  useEffect(() => {
    if (!carouselApi || !activeVariantImageUrl) return
    const idx = galleryImages.indexOf(activeVariantImageUrl)
    if (idx >= 0) {
      setActiveImageIndex(idx)
      carouselApi.scrollTo(idx)
    }
  }, [activeVariantImageUrl, carouselApi, galleryImages])

  return (
    <div className="lg:col-span-6 space-y-4">
      <div className="relative">
        {isOutOfStock ? (
          <Badge variant="destructive" className="pointer-events-none absolute top-4 left-4 z-10">
            Out of Stock
          </Badge>
        ) : isLowStock ? (
          <Badge variant="outline" className="pointer-events-none absolute top-4 left-4 z-10">
            <AlertTriangle className="h-3.5 w-3.5" aria-hidden="true" />
            <span>Low Stock: Only {availableStock} Left</span>
          </Badge>
        ) : (
          <Badge variant="outline" className="pointer-events-none absolute top-4 left-4 z-10">
            <CheckCircle2 className="h-3.5 w-3.5" aria-hidden="true" />
            <span>In Stock ({availableStock} ready)</span>
          </Badge>
        )}

        <Carousel
          setApi={setCarouselApi}
          opts={{ loop: galleryImages.length > 1 }}
          className="w-full"
          aria-label={`${productTitle} product images`}
        >
          <CarouselContent>
            {galleryImages.map((imgUrl, idx) => (
              <CarouselItem key={`${productId}-slide-${idx}`}>
                <div className="flex min-h-[380px] sm:min-h-[460px] items-center justify-center rounded-md border border-border bg-card p-8">
                  <OptimizedImage
                    src={imgUrl}
                    alt={`${productTitle} — image ${idx + 1}`}
                    width={520}
                    height={520}
                    priority={idx === 0}
                    fetchPriority={idx === 0 ? 'high' : 'low'}
                    loading={idx === 0 ? 'eager' : 'lazy'}
                    className="max-h-[360px] w-auto object-contain drop-shadow-xl"
                  />
                </div>
              </CarouselItem>
            ))}
          </CarouselContent>
          {galleryImages.length > 1 && (
            <>
              <CarouselPrevious className="left-3" />
              <CarouselNext className="right-3" />
            </>
          )}
        </Carousel>
      </div>

      {galleryImages.length > 1 && (
        <div
          className="grid grid-cols-4 gap-3"
          role="tablist"
          aria-label="Product gallery thumbnails"
        >
          {galleryImages.map((imgUrl, idx) => (
            <button
              key={`${productId}-thumb-${idx}`}
              type="button"
              role="tab"
              aria-selected={activeImageIndex === idx}
              onClick={() => {
                setActiveImageIndex(idx)
                carouselApi?.scrollTo(idx)
              }}
              className={cn(
                'rounded-md border p-2.5 bg-card flex items-center justify-center h-20 transition-all cursor-pointer',
                activeImageIndex === idx
                  ? 'border-primary ring-2 ring-primary/40'
                  : 'border-border hover:border-primary/60',
              )}
            >
              <OptimizedImage
                src={imgUrl}
                alt={`${productTitle} thumbnail ${idx + 1}`}
                width={100}
                height={100}
                className="max-h-full w-auto object-contain"
              />
            </button>
          ))}
        </div>
      )}
    </div>
  )
}
