import { OG_IMAGE_SIZE, renderProductOgImage } from '@/lib/og-image'
import { getProductBySlugServer } from '@/lib/payload-server'

export const runtime = 'nodejs'
export const alt = 'Shop this piece at Storefront Atelier'
export const size = OG_IMAGE_SIZE
export const contentType = 'image/png'

export default async function ProductOpenGraphImage({
  params,
}: {
  params: Promise<{ slug: string }>
}) {
  const { slug } = await params
  const product = await getProductBySlugServer(slug)

  return renderProductOgImage({
    product,
    badgeLabel: product ? product.category : 'Storefront Atelier',
    fallbackTitle: 'Explore Storefront Atelier',
    fallbackSubtitle: 'Curated Apparel & Footwear',
  })
}
