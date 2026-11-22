'use client'

import { Image } from '@imagekit/next'

export interface OptimizedImageProps {
  src: string
  alt: string
  width?: number
  height?: number
  className?: string
  priority?: boolean
  fetchPriority?: 'high' | 'low' | 'auto'
  loading?: 'eager' | 'lazy'
  onLoad?: () => void
}

export function OptimizedImage({
  src,
  alt,
  width = 480,
  height = 480,
  className,
  priority = false,
  fetchPriority,
  loading,
  onLoad,
}: OptimizedImageProps) {
  const hasExternalImageKit = Boolean(process.env.NEXT_PUBLIC_IMAGEKIT_URL_ENDPOINT)

  const resolvedPriority = fetchPriority === 'high' ? true : priority
  const resolvedLoading =
    resolvedPriority || fetchPriority === 'high' ? undefined : loading || 'lazy'

  return (
    <Image
      src={src}
      alt={alt}
      width={width}
      height={height}
      className={className}
      priority={resolvedPriority}
      fetchPriority={fetchPriority === 'auto' ? undefined : fetchPriority}
      loading={resolvedLoading}
      unoptimized={!hasExternalImageKit}
      transformation={hasExternalImageKit ? [{ width, height, quality: 85, format: 'auto' }] : []}
      onLoad={onLoad}
    />
  )
}
