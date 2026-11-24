import { OG_IMAGE_SIZE, renderProductOgImage } from '@/lib/og-image'
import { getFeaturedProductServer } from '@/lib/payload-server'

export const runtime = 'nodejs'
export const alt = 'Storefront ComposeIt — Featured Piece — Shop Now'
export const size = OG_IMAGE_SIZE
export const contentType = 'image/png'

export default async function OpenGraphImage() {
  const featuredProduct = await getFeaturedProductServer()

  return renderProductOgImage({
    product: featuredProduct,
    badgeLabel: 'Featured Product',
    fallbackTitle: 'Curated Clothing & Footwear',
    fallbackSubtitle: 'Storefront ComposeIt Collection',
  })
}
