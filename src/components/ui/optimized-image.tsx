'use client';

import React, { ReactNode } from 'react';
import { Image as IKImage, ImageKitProvider } from '@imagekit/next';

const DEFAULT_IK_ENDPOINT =
  process.env.NEXT_PUBLIC_IMAGEKIT_URL_ENDPOINT || 'http://localhost:3000';

export function StoreImageKitProvider({ children }: { children: ReactNode }) {
  const endpoint =
    process.env.NEXT_PUBLIC_IMAGEKIT_URL_ENDPOINT ||
    (typeof window !== 'undefined' ? window.location.origin : DEFAULT_IK_ENDPOINT);

  return (
    <ImageKitProvider urlEndpoint={endpoint} transformationPosition="query">
      {children}
    </ImageKitProvider>
  );
}

export interface OptimizedImageProps {
  src: string;
  alt: string;
  width?: number;
  height?: number;
  className?: string;
  priority?: boolean;
  fetchPriority?: 'high' | 'low' | 'auto';
  loading?: 'eager' | 'lazy';
  onLoad?: () => void;
}

/**
 * Wrapper around `@imagekit/next` Image component with automatic transformation
 * parameters and LCP / lazy-loading fetchPriority support.
 */
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
  const hasExternalImageKit = Boolean(
    process.env.NEXT_PUBLIC_IMAGEKIT_URL_ENDPOINT &&
      !process.env.NEXT_PUBLIC_IMAGEKIT_URL_ENDPOINT.includes('your_imagekit_id')
  );

  const resolvedPriority = fetchPriority === 'high' ? true : priority;
  const resolvedLoading =
    resolvedPriority || fetchPriority === 'high'
      ? undefined
      : loading || 'lazy';

  return (
    <IKImage
      src={src}
      alt={alt}
      width={width}
      height={height}
      className={className}
      priority={resolvedPriority}
      fetchPriority={fetchPriority === 'auto' ? undefined : fetchPriority}
      loading={resolvedLoading}
      unoptimized={!hasExternalImageKit}
      transformation={
        hasExternalImageKit
          ? [{ width, height, quality: 85, format: 'auto' }]
          : []
      }
      onLoad={onLoad}
    />
  );
}
