import type { Metadata } from 'next'
import { ProductDetails } from '@/components/products'
import { getProductBySlugServer } from '@/lib/payload-server'
import { formatCentsAsDollars } from '@/lib/utils/products'

export async function generateMetadata({
  params,
}: {
  params: Promise<{ slug: string }>
}): Promise<Metadata> {
  const { slug } = await params
  const product = await getProductBySlugServer(slug)

  if (!product) {
    return {
      title: 'Product Not Found',
      description: 'The requested product could not be found in the Storefront ComposeIt catalog.',
      robots: {
        index: false,
        follow: false,
      },
    }
  }

  const price = formatCentsAsDollars(product.price)
  const title = `${product.title} by ${product.brand}`
  const baseDescription =
    product.description?.trim() || `${product.title} by ${product.brand} (${product.subcategory}).`
  const description = `${baseDescription} ${price} — shop available sizes and colors at Storefront ComposeIt.`

  return {
    title,
    description,
    alternates: {
      canonical: `/products/${product.slug}`,
    },
    openGraph: {
      type: 'website',
      url: `/products/${product.slug}`,
      title: `${product.title} — ${price}`,
      description,
    },
    twitter: {
      card: 'summary_large_image',
      title: `${product.title} — ${price}`,
      description,
    },
  }
}

export default function ProductDetailPage() {
  return <ProductDetails />
}
