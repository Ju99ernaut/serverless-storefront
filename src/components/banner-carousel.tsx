'use client'

import { useEffect, useState } from 'react'
import Link from 'next/link'
import { cn } from 'cn'
import { OptimizedImage } from './ui/optimized-image'
import { Badge } from './ui/badge'
import { Button, buttonVariants } from './ui/button'
import {
  Carousel,
  CarouselContent,
  CarouselItem,
  CarouselNext,
  CarouselPrevious,
  type CarouselApi,
} from './ui/carousel'
import type { Banner } from '@/payload-types'

interface BannerCarouselProps {
  banners: Banner[]
  onCategorySelect: (filter: string) => void
}

export default function BannerCarousel({ banners, onCategorySelect }: BannerCarouselProps) {
  const [api, setApi] = useState<CarouselApi>()
  const [currentIndex, setCurrentIndex] = useState(0)
  const [isPaused, setIsPaused] = useState(false)

  useEffect(() => {
    if (!api) return

    const onSelect = () => {
      setCurrentIndex(api.selectedScrollSnap())
    }

    onSelect()
    api.on('select', onSelect)
    api.on('reInit', onSelect)

    return () => {
      api.off('select', onSelect)
      api.off('reInit', onSelect)
    }
  }, [api])

  useEffect(() => {
    if (!api || banners.length <= 1 || isPaused) return

    const interval = setInterval(() => {
      api.scrollNext()
    }, 6500)

    return () => clearInterval(interval)
  }, [api, banners.length, isPaused])

  if (!banners || banners.length === 0) return null

  return (
    <section
      aria-label="Featured Storefront Collections"
      className="relative mx-auto w-full max-w-[1280px] rounded-lg md:mt-6 md:mb-6 md:w-[92%]"
      onMouseEnter={() => setIsPaused(true)}
      onMouseLeave={() => setIsPaused(false)}
      onFocusCapture={() => setIsPaused(true)}
      onBlurCapture={() => setIsPaused(false)}
    >
      <div className="relative overflow-hidden rounded-md md:border md:border-border md:bg-card md:shadow-sm">
        <Carousel setApi={setApi} opts={{ loop: banners.length > 1 }} className="w-full">
          <CarouselContent>
            {banners.map((slide, idx) => (
              <CarouselItem key={slide.id}>
                <div className="relative grid min-h-[260px] grid-cols-1 items-center gap-6 px-6 py-8 md:min-h-[300px] md:grid-cols-12 md:px-14 md:py-10">
                  {/* Accent ambient backdrop */}
                  <div
                    aria-hidden="true"
                    className="pointer-events-none absolute inset-0 opacity-20"
                    style={{
                      background: `radial-gradient(circle at 80% 35%, ${slide.accentColor || '#5C5EDC'}, transparent 60%)`,
                    }}
                  />

                  {/* Copy & Actions */}
                  <div className="relative z-10 flex flex-col items-center gap-3 text-center md:col-span-7 md:items-start md:text-left">
                    <Badge variant="outline" className="gap-1.5 px-3 py-1 text-xs">
                      <span>{slide.badgeText}</span>
                    </Badge>

                    <h2 className="text-2xl leading-tight font-bold tracking-tight text-foreground sm:text-3xl md:text-4xl">
                      {slide.title}
                    </h2>

                    <p className="max-w-xl text-sm leading-relaxed text-muted-foreground sm:text-base">
                      {slide.subtitle}
                    </p>

                    <div className="flex flex-wrap items-center justify-center gap-3 pt-2">
                      <Button
                        type="button"
                        onClick={() => onCategorySelect(slide.ctaFilter || 'all')}
                        className="gap-2"
                      >
                        {slide.ctaText}
                      </Button>

                      {slide.ctaProductSlug && (
                        <Link
                          className={buttonVariants({ variant: 'outline' })}
                          href={`/products/${slide.ctaProductSlug}`}
                        >
                          View Spotlight Piece
                        </Link>
                      )}
                    </div>
                  </div>

                  {/* Product/Editorial Hero Visual */}
                  <div className="relative z-10 flex items-center justify-center md:col-span-5">
                    <div className="relative flex h-64 w-64 items-center justify-center rounded-md border border-border shadow-inner">
                      <OptimizedImage
                        src={slide.imageUrl}
                        alt={slide.title}
                        width={320}
                        height={320}
                        priority={idx === 0}
                        fetchPriority={idx === 0 ? 'high' : 'low'}
                        loading={idx === 0 ? 'eager' : 'lazy'}
                        className="h-full w-full rounded-md object-cover drop-shadow-xl"
                      />
                    </div>
                  </div>
                </div>
              </CarouselItem>
            ))}
          </CarouselContent>

          {banners.length > 1 && (
            <>
              <CarouselPrevious className="left-3 hidden md:inline-flex" />
              <CarouselNext className="right-3 hidden md:inline-flex" />
            </>
          )}
        </Carousel>

        {banners.length > 1 && (
          <div
            className="absolute bottom-0 w-full flex items-center justify-center gap-2 pb-4"
            role="tablist"
            aria-label="Banner slide navigation"
          >
            {banners.map((slide, idx) => (
              <button
                key={`${slide.id}-dot`}
                type="button"
                role="tab"
                aria-selected={currentIndex === idx}
                aria-label={`Go to slide ${idx + 1}: ${slide.title}`}
                onClick={() => api?.scrollTo(idx)}
                className={cn(
                  'h-2 cursor-pointer rounded-full transition-all',
                  currentIndex === idx
                    ? 'w-6 bg-primary'
                    : 'w-2 bg-muted-foreground/35 hover:bg-muted-foreground/60',
                )}
              />
            ))}
          </div>
        )}
      </div>
    </section>
  )
}
