import { readFile } from 'node:fs/promises'
import path from 'node:path'
import { ImageResponse } from 'next/og'
import type { Product } from '@/payload-types'
import { formatCentsAsDollars, getProductImages } from './utils/data'

export const OG_IMAGE_SIZE = {
  width: 1200,
  height: 630,
}

export function getSiteUrl(): string {
  const raw =
    process.env.NEXT_PUBLIC_APP_URL ||
    (process.env.VERCEL_URL ? `https://${process.env.VERCEL_URL}` : 'http://localhost:3000')
  return raw.replace(/\/+$/, '')
}

async function resolveOgImageSrc(rawUrl: string | undefined): Promise<string | null> {
  if (!rawUrl) return null
  if (rawUrl.startsWith('data:')) return rawUrl
  if (rawUrl.startsWith('http://') || rawUrl.startsWith('https://')) {
    return rawUrl
  }

  if (rawUrl.startsWith('/')) {
    try {
      const publicFilePath = path.join(process.cwd(), 'public', rawUrl.replace(/^\/+/, ''))
      const fileBuffer = await readFile(publicFilePath)
      const ext = path.extname(publicFilePath).toLowerCase()
      const mimeType =
        ext === '.png'
          ? 'image/png'
          : ext === '.webp'
            ? 'image/webp'
            : ext === '.svg'
              ? 'image/svg+xml'
              : 'image/jpeg'
      return `data:${mimeType};base64,${fileBuffer.toString('base64')}`
    } catch {
      return `${getSiteUrl()}${rawUrl}`
    }
  }

  return `${getSiteUrl()}/${rawUrl}`
}

export async function renderProductOgImage(options: {
  product: Product | null
  badgeLabel: string
  fallbackTitle?: string
  fallbackSubtitle?: string
}) {
  const { product, badgeLabel, fallbackTitle, fallbackSubtitle } = options

  const rawImageUrl = product ? getProductImages(product)[0] : '/images/shirt.png'
  const imageSrc = await resolveOgImageSrc(rawImageUrl)

  const title = product?.title || fallbackTitle || 'Curated Clothing & Footwear'
  const subtitle = product?.brand
    ? `${product.brand} • ${product.subcategory || product.category}`
    : fallbackSubtitle || 'Tailored outerwear, shirts, dresses, trousers & footwear'
  const description =
    product?.description?.trim() ||
    'Live size availability, flexible delivery or boutique collection, and instant order tracking.'
  const truncatedDescription =
    description.length > 130 ? `${description.slice(0, 127).trimEnd()}...` : description

  const priceLabel = product ? formatCentsAsDollars(product.price) : null
  const compareAtLabel =
    product?.compareAtPrice && product.compareAtPrice > product.price
      ? formatCentsAsDollars(product.compareAtPrice)
      : null

  return new ImageResponse(
    <div
      style={{
        width: '100%',
        height: '100%',
        display: 'flex',
        backgroundColor: '#18191e',
        color: '#f8fafc',
        padding: '48px 56px',
        fontFamily: 'sans-serif',
        position: 'relative',
        justifyContent: 'space-between',
        alignItems: 'center',
        gap: '44px',
      }}
    >
      {/* Left column: Storefront branding, product info & Shop Now CTA */}
      <div
        style={{
          display: 'flex',
          flexDirection: 'column',
          justifyContent: 'space-between',
          height: '100%',
          flex: 1,
        }}
      >
        <div style={{ display: 'flex', alignItems: 'center', gap: '14px' }}>
          <div
            style={{
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'center',
              padding: '7px 14px',
              borderRadius: '9999px',
              backgroundColor: '#5c5edc',
              color: '#ffffff',
              fontSize: '16px',
              fontWeight: 700,
              letterSpacing: '0.08em',
              textTransform: 'uppercase',
            }}
          >
            {badgeLabel}
          </div>
          <span
            style={{
              fontSize: '18px',
              fontWeight: 600,
              color: '#a1a1aa',
              letterSpacing: '0.04em',
            }}
          >
            Storefront ComposeIt
          </span>
        </div>

        <div style={{ display: 'flex', flexDirection: 'column', gap: '14px' }}>
          <div
            style={{
              display: 'flex',
              fontSize: '20px',
              fontWeight: 600,
              color: '#a5b4fc',
              textTransform: 'uppercase',
              letterSpacing: '0.06em',
            }}
          >
            {subtitle}
          </div>

          <div
            style={{
              display: 'flex',
              fontSize: '50px',
              fontWeight: 800,
              lineHeight: 1.1,
              letterSpacing: '-0.02em',
              color: '#ffffff',
            }}
          >
            {title}
          </div>

          <div
            style={{
              display: 'flex',
              fontSize: '22px',
              lineHeight: 1.4,
              color: '#cbd5e1',
            }}
          >
            {truncatedDescription}
          </div>

          {priceLabel && (
            <div
              style={{
                display: 'flex',
                alignItems: 'baseline',
                gap: '16px',
                marginTop: '6px',
              }}
            >
              <span
                style={{
                  fontSize: '40px',
                  fontWeight: 800,
                  color: '#ffffff',
                }}
              >
                {priceLabel}
              </span>
              {compareAtLabel && (
                <span
                  style={{
                    fontSize: '24px',
                    fontWeight: 500,
                    color: '#94a3b8',
                    textDecoration: 'line-through',
                  }}
                >
                  {compareAtLabel}
                </span>
              )}
            </div>
          )}
        </div>

        {/* Shop Now CTA Button */}
        <div style={{ display: 'flex', alignItems: 'center', gap: '20px' }}>
          <div
            style={{
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'center',
              backgroundColor: '#5c5edc',
              color: '#ffffff',
              padding: '16px 34px',
              borderRadius: '10px',
              fontSize: '22px',
              fontWeight: 700,
              letterSpacing: '0.02em',
            }}
          >
            Shop Now →
          </div>
          <span style={{ fontSize: '18px', color: '#94a3b8' }}>
            Free Boutique Collection • Tracked Delivery
          </span>
        </div>
      </div>

      {/* Right column: Product image showcase */}
      <div
        style={{
          display: 'flex',
          width: '410px',
          height: '534px',
          borderRadius: '20px',
          backgroundColor: '#25262d',
          border: '1px solid #383a46',
          alignItems: 'center',
          justifyContent: 'center',
          padding: '28px',
          overflow: 'hidden',
          flexShrink: 0,
        }}
      >
        {imageSrc ? (
          // eslint-disable-next-line @next/next/no-img-element
          <img
            src={imageSrc}
            alt={title}
            style={{
              width: '100%',
              height: '100%',
              objectFit: 'contain',
            }}
          />
        ) : (
          <div
            style={{
              display: 'flex',
              fontSize: '28px',
              fontWeight: 700,
              color: '#94a3b8',
            }}
          >
            Storefront ComposeIt
          </div>
        )}
      </div>
    </div>,
    {
      ...OG_IMAGE_SIZE,
    },
  )
}
