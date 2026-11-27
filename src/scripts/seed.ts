import 'dotenv/config'
import { getPayload } from 'payload'
import config from '../payload.config'
import { HOME_BANNERS, PRODUCTS } from '../../tests/int/products'

const UNSPLASH_BANNER_IMAGES: Record<string, string> = {
  'moto-full-grain-biker-jacket':
    'https://images.unsplash.com/photo-1551028719-00167b16eac5?auto=format&fit=crop&w=1400&q=80',
  'silk-charmeuse-evening-gown':
    'https://images.unsplash.com/photo-1566174053879-31528523f8ae?auto=format&fit=crop&w=1400&q=80',
  'milan-leather-chelsea-boot':
    'https://images.unsplash.com/photo-1638247025967-b4e38f787b76?auto=format&fit=crop&w=1400&q=80',
  'classic-oxford-button-down':
    'https://images.unsplash.com/photo-1714317438040-0e8584215699?auto=format&fit=crop&w=1400&q=80',
}

const UNSPLASH_PRODUCT_IMAGES: Record<string, string[]> = {
  // Shirts
  'classic-oxford-button-down': [
    'https://images.unsplash.com/photo-1714317438040-0e8584215699?auto=format&fit=crop&w=1000&q=80',
    'https://images.unsplash.com/photo-1611608822650-925c227ef4d2?auto=format&fit=crop&w=1000&q=80',
    'https://images.unsplash.com/photo-1583743814966-8936f5b7be1a?auto=format&fit=crop&w=1000&q=80',
  ],
  'organic-pima-crewneck-shirt': [
    'https://images.unsplash.com/photo-1583743814966-8936f5b7be1a?auto=format&fit=crop&w=1000&q=80',
    'https://images.unsplash.com/photo-1611608822650-925c227ef4d2?auto=format&fit=crop&w=1000&q=80',
    'https://images.unsplash.com/photo-1714317438040-0e8584215699?auto=format&fit=crop&w=1000&q=80',
  ],
  'brushed-highland-flannel-shirt': [
    'https://images.unsplash.com/photo-1680651270398-2eeb8d1b1524?auto=format&fit=crop&w=1000&q=80',
    'https://images.unsplash.com/photo-1714317438040-0e8584215699?auto=format&fit=crop&w=1000&q=80',
    'https://images.unsplash.com/photo-1583743814966-8936f5b7be1a?auto=format&fit=crop&w=1000&q=80',
  ],
  'coastal-pure-linen-shirt': [
    'https://images.unsplash.com/photo-1611608822650-925c227ef4d2?auto=format&fit=crop&w=1000&q=80',
    'https://images.unsplash.com/photo-1714317438040-0e8584215699?auto=format&fit=crop&w=1000&q=80',
    'https://images.unsplash.com/photo-1680651270398-2eeb8d1b1524?auto=format&fit=crop&w=1000&q=80',
  ],
  'merino-piqu-knit-polo': [
    'https://images.unsplash.com/photo-1611608822650-925c227ef4d2?auto=format&fit=crop&w=1000&q=80',
    'https://images.unsplash.com/photo-1583743814966-8936f5b7be1a?auto=format&fit=crop&w=1000&q=80',
    'https://images.unsplash.com/photo-1714317438040-0e8584215699?auto=format&fit=crop&w=1000&q=80',
  ],

  // Jackets
  'moto-full-grain-biker-jacket': [
    'https://images.unsplash.com/photo-1551028719-00167b16eac5?auto=format&fit=crop&w=1000&q=80',
    'https://images.unsplash.com/photo-1544441893-675973e31985?auto=format&fit=crop&w=1000&q=80',
    'https://images.unsplash.com/photo-1539571696357-5a69c17a67c6?auto=format&fit=crop&w=1000&q=80',
  ],
  'ma-1-flight-bomber-jacket': [
    'https://images.unsplash.com/photo-1544441893-675973e31985?auto=format&fit=crop&w=1000&q=80',
    'https://images.unsplash.com/photo-1551028719-00167b16eac5?auto=format&fit=crop&w=1000&q=80',
    'https://images.unsplash.com/photo-1576995853123-5a10305d93c0?auto=format&fit=crop&w=1000&q=80',
  ],
  'arctic-down-expedition-parka': [
    'https://images.unsplash.com/photo-1539571696357-5a69c17a67c6?auto=format&fit=crop&w=1000&q=80',
    'https://images.unsplash.com/photo-1544441893-675973e31985?auto=format&fit=crop&w=1000&q=80',
    'https://images.unsplash.com/photo-1551028719-00167b16eac5?auto=format&fit=crop&w=1000&q=80',
  ],
  'vintage-sherpa-trucker-denim-jacket': [
    'https://images.unsplash.com/photo-1576995853123-5a10305d93c0?auto=format&fit=crop&w=1000&q=80',
    'https://images.unsplash.com/photo-1706558426378-2f4bacb35791?auto=format&fit=crop&w=1000&q=80',
    'https://images.unsplash.com/photo-1551028719-00167b16eac5?auto=format&fit=crop&w=1000&q=80',
  ],

  // Dresses
  'riviera-midi-sundress': [
    'https://images.unsplash.com/photo-1496747611176-843222e1e57c?auto=format&fit=crop&w=1000&q=80',
    'https://images.unsplash.com/photo-1515886657613-9f3515b0c78f?auto=format&fit=crop&w=1000&q=80',
    'https://images.unsplash.com/photo-1566174053879-31528523f8ae?auto=format&fit=crop&w=1000&q=80',
  ],
  'noir-velvet-cocktail-dress': [
    'https://images.unsplash.com/photo-1539109136881-3be0616acf4b?auto=format&fit=crop&w=1000&q=80',
    'https://images.unsplash.com/photo-1566174053879-31528523f8ae?auto=format&fit=crop&w=1000&q=80',
    'https://images.unsplash.com/photo-1518895949257-7621c3c786d7?auto=format&fit=crop&w=1000&q=80',
  ],
  'silk-charmeuse-evening-gown': [
    'https://images.unsplash.com/photo-1566174053879-31528523f8ae?auto=format&fit=crop&w=1000&q=80',
    'https://images.unsplash.com/photo-1518895949257-7621c3c786d7?auto=format&fit=crop&w=1000&q=80',
    'https://images.unsplash.com/photo-1539109136881-3be0616acf4b?auto=format&fit=crop&w=1000&q=80',
  ],
  'bohemian-tiered-maxi-dress': [
    'https://images.unsplash.com/photo-1515886657613-9f3515b0c78f?auto=format&fit=crop&w=1000&q=80',
    'https://images.unsplash.com/photo-1496747611176-843222e1e57c?auto=format&fit=crop&w=1000&q=80',
    'https://images.unsplash.com/photo-1518895949257-7621c3c786d7?auto=format&fit=crop&w=1000&q=80',
  ],

  // Trousers
  'savile-stretch-tapered-chinos': [
    'https://images.unsplash.com/photo-1509631179647-0177331693ae?auto=format&fit=crop&w=1000&q=80',
    'https://images.unsplash.com/photo-1585487000160-6ebcfceb0d03?auto=format&fit=crop&w=1000&q=80',
    'https://images.unsplash.com/photo-1542272604-787c3835535d?auto=format&fit=crop&w=1000&q=80',
  ],
  'selvedge-raw-indigo-denim': [
    'https://images.unsplash.com/photo-1542272604-787c3835535d?auto=format&fit=crop&w=1000&q=80',
    'https://images.unsplash.com/photo-1541099649105-f69ad21f3246?auto=format&fit=crop&w=1000&q=80',
    'https://images.unsplash.com/photo-1585487000160-6ebcfceb0d03?auto=format&fit=crop&w=1000&q=80',
  ],
  'utility-ripstop-cargo-pant': [
    'https://images.unsplash.com/photo-1541099649105-f69ad21f3246?auto=format&fit=crop&w=1000&q=80',
    'https://images.unsplash.com/photo-1509631179647-0177331693ae?auto=format&fit=crop&w=1000&q=80',
    'https://images.unsplash.com/photo-1542272604-787c3835535d?auto=format&fit=crop&w=1000&q=80',
  ],
  'essential-two-pack-chino-bundle': [
    'https://images.unsplash.com/photo-1585487000160-6ebcfceb0d03?auto=format&fit=crop&w=1000&q=80',
    'https://images.unsplash.com/photo-1509631179647-0177331693ae?auto=format&fit=crop&w=1000&q=80',
    'https://images.unsplash.com/photo-1541099649105-f69ad21f3246?auto=format&fit=crop&w=1000&q=80',
  ],
  'pleated-flannel-dress-trousers': [
    'https://images.unsplash.com/photo-1509631179647-0177331693ae?auto=format&fit=crop&w=1000&q=80',
    'https://images.unsplash.com/photo-1542272604-787c3835535d?auto=format&fit=crop&w=1000&q=80',
    'https://images.unsplash.com/photo-1585487000160-6ebcfceb0d03?auto=format&fit=crop&w=1000&q=80',
  ],

  // Shoes
  'milan-leather-chelsea-boot': [
    'https://images.unsplash.com/photo-1638247025967-b4e38f787b76?auto=format&fit=crop&w=1000&q=80',
    'https://images.unsplash.com/photo-1608256246200-53e635b5b65f?auto=format&fit=crop&w=1000&q=80',
  ],
  'cloudstride-knit-runner': [
    'https://images.unsplash.com/photo-1542291026-7eec264c27ff?auto=format&fit=crop&w=1000&q=80',
    'https://images.unsplash.com/photo-1595950653106-6c9ebd614d3a?auto=format&fit=crop&w=1000&q=80',
    'https://images.unsplash.com/photo-1560769629-975ec94e6a86?auto=format&fit=crop&w=1000&q=80',
  ],
  'mayfair-penny-loafer': [
    'https://images.unsplash.com/photo-1638247025967-b4e38f787b76?auto=format&fit=crop&w=1000&q=80',
    'https://images.unsplash.com/photo-1560769629-975ec94e6a86?auto=format&fit=crop&w=1000&q=80',
  ],
  'nordic-gore-tex-trail-boot': [
    'https://images.unsplash.com/photo-1608256246200-53e635b5b65f?auto=format&fit=crop&w=1000&q=80',
    'https://images.unsplash.com/photo-1638247025967-b4e38f787b76?auto=format&fit=crop&w=1000&q=80',
  ],
  'boardwalk-vulcanized-canvas-low': [
    'https://images.unsplash.com/photo-1525966222134-fcfa99b8ae77?auto=format&fit=crop&w=1000&q=80',
    'https://images.unsplash.com/photo-1560769629-975ec94e6a86?auto=format&fit=crop&w=1000&q=80',
    'https://images.unsplash.com/photo-1595950653106-6c9ebd614d3a?auto=format&fit=crop&w=1000&q=80',
  ],
}

const CATEGORY_FALLBACK_IMAGES: Record<string, string[]> = {
  jackets: [
    'https://images.unsplash.com/photo-1551028719-00167b16eac5?auto=format&fit=crop&w=1000&q=80',
  ],
  shirts: [
    'https://images.unsplash.com/photo-1714317438040-0e8584215699?auto=format&fit=crop&w=1000&q=80',
  ],
  dresses: [
    'https://images.unsplash.com/photo-1566174053879-31528523f8ae?auto=format&fit=crop&w=1000&q=80',
  ],
  trousers: [
    'https://images.unsplash.com/photo-1542272604-787c3835535d?auto=format&fit=crop&w=1000&q=80',
  ],
  shoes: [
    'https://images.unsplash.com/photo-1638247025967-b4e38f787b76?auto=format&fit=crop&w=1000&q=80',
  ],
}

const DEFAULT_BANNER_IMAGE =
  'https://images.unsplash.com/photo-1551028719-00167b16eac5?auto=format&fit=crop&w=1400&q=80'

function extensionFromMime(mimeType: string): string {
  if (mimeType.includes('png')) return 'png'
  if (mimeType.includes('webp')) return 'webp'
  if (mimeType.includes('gif')) return 'gif'
  return 'jpg'
}

function slugifyUrl(url: string, index: number): string {
  const parsed = new URL(url)
  const photoId = parsed.pathname.split('/').filter(Boolean).pop() || `image-${index}`
  const width = parsed.searchParams.get('w') || 'full'
  return `seed-${photoId}-w${width}`.replace(/[^a-zA-Z0-9-_]/g, '-')
}

async function getOrCreateMedia(
  payload: Awaited<ReturnType<typeof getPayload>>,
  url: string,
  alt: string,
  cache: Map<string, number>,
) {
  const cached = cache.get(url)
  if (cached !== undefined) {
    return cached
  }

  const response = await fetch(url)
  if (!response.ok) {
    throw new Error(`Failed to fetch image (${response.status}): ${url}`)
  }

  const contentType = response.headers.get('content-type') || 'image/jpeg'
  const mimeType = contentType.split(';')[0].trim()
  const ext = extensionFromMime(mimeType)
  const arrayBuffer = await response.arrayBuffer()
  const buffer = Buffer.from(arrayBuffer)
  const filename = `${slugifyUrl(url, cache.size + 1)}.${ext}`

  const existing = await payload.find({
    collection: 'media',
    where: {
      filename: {
        equals: filename,
      },
    },
    limit: 1,
  })

  let mediaId: string | number
  if (existing.docs.length > 0) {
    const updated = await payload.update({
      collection: 'media',
      id: existing.docs[0].id,
      data: { alt },
      file: {
        data: buffer,
        mimetype: mimeType,
        name: filename,
        size: buffer.length,
      },
    })
    mediaId = updated.id
  } else {
    const created = await payload.create({
      collection: 'media',
      data: { alt },
      file: {
        data: buffer,
        mimetype: mimeType,
        name: filename,
        size: buffer.length,
      },
    })
    mediaId = created.id
  }

  cache.set(url, mediaId)
  return mediaId
}

async function seed() {
  const payload = await getPayload({ config })
  const mediaCache = new Map<string, number>()

  console.log('Seeding banners...')
  let bannersCreated = 0
  let bannersUpdated = 0

  for (const banner of HOME_BANNERS) {
    const imageUrl =
      (banner.ctaProductSlug && UNSPLASH_BANNER_IMAGES[banner.ctaProductSlug]) ||
      DEFAULT_BANNER_IMAGE

    const mediaId = await getOrCreateMedia(payload, imageUrl, banner.title, mediaCache)

    const data = {
      title: banner.title,
      subtitle: banner.subtitle,
      badgeText: banner.badgeText,
      imageUrl: mediaId,
      ctaText: banner.ctaText,
      ctaFilter: banner.ctaFilter,
      ctaProductSlug: banner.ctaProductSlug,
      accentColor: banner.accentColor,
      active: banner.active ?? true,
      sortOrder: banner.sortOrder ?? 0,
    }

    const existing = await payload.find({
      collection: 'banners',
      where: {
        title: {
          equals: banner.title,
        },
      },
      limit: 1,
    })

    if (existing.docs.length > 0) {
      await payload.update({
        collection: 'banners',
        id: existing.docs[0].id,
        data,
      })
      bannersUpdated++
    } else {
      await payload.create({
        collection: 'banners',
        data,
      })
      bannersCreated++
    }
  }

  console.log(`Banners complete: ${bannersCreated} created, ${bannersUpdated} updated.`)

  console.log('Seeding products...')
  let productsCreated = 0
  let productsUpdated = 0

  for (const product of PRODUCTS) {
    const imageUrls =
      UNSPLASH_PRODUCT_IMAGES[product.slug] ||
      CATEGORY_FALLBACK_IMAGES[product.category] ||
      CATEGORY_FALLBACK_IMAGES.shirts

    const mediaIds = await Promise.all(
      imageUrls.map((url, idx) =>
        getOrCreateMedia(payload, url, `${product.title} view ${idx + 1}`, mediaCache),
      ),
    )

    const primaryMediaId = mediaIds[0]

    const data = {
      slug: product.slug,
      title: product.title,
      brand: product.brand,
      price: product.price,
      compareAtPrice: product.compareAtPrice ?? undefined,
      category: product.category,
      subcategory: product.subcategory,
      tags: (product.tags ?? []).map((t) => ({ tag: t.tag })),
      size: product.size ?? 'normal',
      description: product.description ?? undefined,
      material: product.material,
      fit: product.fit,
      care: product.care,
      images: mediaIds.map((mediaId, idx) => ({
        url: mediaId,
        alt: `${product.title} view ${idx + 1}`,
      })),
      variants: (product.variants ?? []).map((v) => ({
        sku: v.sku,
        size: v.size,
        color: v.color,
        colorHex: v.colorHex,
        priceOverride: v.priceOverride ?? undefined,
        stock: v.stock,
        reservedStock: v.reservedStock,
        lowStockThreshold: v.lowStockThreshold,
        imageUrl: primaryMediaId,
      })),
      averageRating: product.averageRating ?? 0,
      reviewCount: product.reviewCount ?? 0,
      isArchived: product.isArchived ?? false,
    }

    const existing = await payload.find({
      collection: 'products',
      where: {
        slug: {
          equals: product.slug,
        },
      },
      limit: 1,
    })

    if (existing.docs.length > 0) {
      await payload.update({
        collection: 'products',
        id: existing.docs[0].id,
        data,
      })
      productsUpdated++
    } else {
      await payload.create({
        collection: 'products',
        data,
      })
      productsCreated++
    }
  }

  console.log(`Products complete: ${productsCreated} created, ${productsUpdated} updated.`)
  process.exit(0)
}

seed().catch((err) => {
  console.error('Seed failed:', err)
  process.exit(1)
})
