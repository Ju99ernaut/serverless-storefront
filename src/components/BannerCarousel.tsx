'use client';

import { useRef } from 'react';
import Link from 'next/link';
import { Swiper, SwiperSlide } from 'swiper/react';
import { Autoplay, Pagination, Navigation } from 'swiper/modules';
import type { Swiper as SwiperInstance } from 'swiper';
import 'swiper/css';
import 'swiper/css/pagination';
import 'swiper/css/navigation';
import { ArrowRight, ChevronLeft, ChevronRight, Sparkles } from 'lucide-react';
import { OptimizedImage } from './ui/optimized-image';
import { Badge } from './ui/badge';
import { Button } from './ui/button';
import type { BannerSlide } from '../data/products';

interface BannerCarouselProps {
  banners: BannerSlide[];
  onCategorySelect: (filter: string) => void;
}

export default function BannerCarousel({
  banners,
  onCategorySelect,
}: BannerCarouselProps) {
  const swiperRef = useRef<SwiperInstance | null>(null);

  if (!banners || banners.length === 0) return null;

  return (
    <section
      aria-label="Featured Storefront Collections"
      className="mx-auto w-[92%] max-w-[1280px] mb-6 relative"
    >
      <div className="relative overflow-hidden rounded-2xl border border-[var(--border-color)] bg-[var(--surface-card)] shadow-lg">
        <Swiper
          modules={[Autoplay, Pagination, Navigation]}
          onSwiper={(swiper) => {
            swiperRef.current = swiper;
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
                <div className="relative z-10 md:col-span-7 flex flex-col items-start text-left gap-3">
                  <Badge variant="outline" className="gap-1.5 px-3 py-1 text-xs">
                    <Sparkles className="h-3.5 w-3.5" aria-hidden="true" />
                    <span>{slide.badgeText}</span>
                  </Badge>

                  <h2 className="text-2xl sm:text-3xl md:text-4xl font-bold tracking-tight text-[var(--fg-heading)] leading-tight">
                    {slide.title}
                  </h2>

                  <p className="text-sm sm:text-base text-[var(--fg-muted)] max-w-xl leading-relaxed">
                    {slide.subtitle}
                  </p>

                  <div className="flex flex-wrap items-center gap-3 pt-2">
                    <Button
                      type="button"
                      onClick={() => onCategorySelect(slide.ctaFilter)}
                      className="gap-2"
                    >
                      <span>{slide.ctaText}</span>
                      <ArrowRight className="h-4 w-4" aria-hidden="true" />
                    </Button>

                    {slide.ctaProductSlug && (
                      <Button asChild variant="outline">
                        <Link href={`/products/${slide.ctaProductSlug}`}>
                          View Spotlight Piece
                        </Link>
                      </Button>
                    )}
                  </div>
                </div>

                {/* Product/Editorial Hero Visual */}
                <div className="relative z-10 md:col-span-5 flex items-center justify-center">
                  <div className="relative w-44 h-44 sm:w-56 sm:h-56 md:w-64 md:h-64 rounded-2xl bg-[var(--surface-elevated)] border border-[var(--border-color)] p-4 flex items-center justify-center shadow-inner">
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

        {banners.length > 1 && (
          <>
            <button
              type="button"
              onClick={() => swiperRef.current?.slidePrev()}
              aria-label="Previous featured banner"
              className="hidden sm:inline-flex items-center justify-center absolute left-3 top-1/2 -translate-y-1/2 z-20 h-9 w-9 rounded-full bg-[var(--surface-drawer)]/85 border border-[var(--border-color)] text-[var(--fg-heading)] hover:border-[#5C5EDC] hover:text-[#5C5EDC] transition-colors cursor-pointer"
            >
              <ChevronLeft className="h-4 w-4" aria-hidden="true" />
            </button>
            <button
              type="button"
              onClick={() => swiperRef.current?.slideNext()}
              aria-label="Next featured banner"
              className="hidden sm:inline-flex items-center justify-center absolute right-3 top-1/2 -translate-y-1/2 z-20 h-9 w-9 rounded-full bg-[var(--surface-drawer)]/85 border border-[var(--border-color)] text-[var(--fg-heading)] hover:border-[#5C5EDC] hover:text-[#5C5EDC] transition-colors cursor-pointer"
            >
              <ChevronRight className="h-4 w-4" aria-hidden="true" />
            </button>
          </>
        )}
      </div>
    </section>
  );
}
