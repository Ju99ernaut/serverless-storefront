'use client'

import { useRef } from 'react'
import Link from 'next/link'
import { Swiper, SwiperSlide } from 'swiper/react'
import { Autoplay, Pagination, Navigation } from 'swiper/modules'
import type { Swiper as SwiperInstance } from 'swiper'
import 'swiper/css'
import 'swiper/css/pagination'
import 'swiper/css/navigation'
import { OptimizedImage } from './ui/optimized-image'
import { Badge } from './ui/badge'
import { Button, buttonVariants } from './ui/button'
import type { BannerSlide } from '../data/utils'

interface BannerCarouselProps {
  banners: BannerSlide[]
  onCategorySelect: (filter: string) => void
}

export default function BannerCarousel({ banners, onCategorySelect }: BannerCarouselProps) {
  const swiperRef = useRef<SwiperInstance | null>(null)

  if (!banners || banners.length === 0) return null

  return (
    <section
      aria-label="Featured Storefront Collections"
      className="mx-auto w-full md:w-[92%] max-w-[1280px] md:mt-6 md:mb-6 relative rounded-lg"
    >
      <div className="relative overflow-hidden md:border md:border-border md:bg-card md:shadow-sm rounded-md">
        <Swiper
          modules={[Autoplay, Pagination, Navigation]}
          onSwiper={(swiper) => {
            swiperRef.current = swiper
          }}
          autoplay={{
            delay: 5500,
            disableOnInteraction: true,
            pauseOnMouseEnter: true,
          }}
          pagination={{ clickable: true }}
          loop={banners.length > 1}
          slidesPerView={1}
          className="banner-carousel-swiper"
        >
          {banners.map((slide, idx) => (
            <SwiperSlide key={slide.id}>
              <div className="relative grid grid-cols-1 md:grid-cols-12 items-center gap-6 px-6 py-8 md:px-12 md:py-10 min-h-[260px] md:min-h-[300px]">
                {/* Accent ambient backdrop */}
                <div
                  aria-hidden="true"
                  className="pointer-events-none absolute inset-0 opacity-20"
                  style={{
                    background: `radial-gradient(circle at 80% 35%, ${slide.accentColor || '#5C5EDC'}, transparent 60%)`,
                  }}
                />

                {/* Copy & Actions */}
                <div className="relative z-10 md:col-span-7 flex flex-col items-center md:items-start text-center md:text-left gap-3">
                  <Badge variant="outline" className="gap-1.5 px-3 py-1 text-xs">
                    <span>{slide.badgeText}</span>
                  </Badge>

                  <h2 className="text-2xl sm:text-3xl md:text-4xl font-bold tracking-tight text-foreground leading-tight">
                    {slide.title}
                  </h2>

                  <p className="text-sm sm:text-base text-muted-foreground max-w-xl leading-relaxed">
                    {slide.subtitle}
                  </p>

                  <div className="flex flex-wrap items-center gap-3 justify-center pt-2">
                    <Button
                      type="button"
                      onClick={() => onCategorySelect(slide.ctaFilter)}
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
                <div className="relative z-10 md:col-span-5 flex items-center justify-center">
                  <div className="relative w-64 h-64 rounded-md border border-border p-4 flex items-center justify-center shadow-inner">
                    <OptimizedImage
                      src={slide.imageUrl}
                      alt={slide.title}
                      width={320}
                      height={320}
                      priority={idx === 0}
                      fetchPriority={idx === 0 ? 'high' : 'low'}
                      loading={idx === 0 ? 'eager' : 'lazy'}
                      className="w-full h-full object-contain drop-shadow-xl"
                    />
                  </div>
                </div>
              </div>
            </SwiperSlide>
          ))}
        </Swiper>
      </div>
    </section>
  )
}
