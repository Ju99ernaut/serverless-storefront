import type { Metadata } from 'next'
import { HomeContentLayout } from '@/components/home-content-layout'

export const metadata: Metadata = {
  title: {
    absolute: 'Storefront ComposeIt — Curated Clothing & Footwear',
  },
  description:
    'Shop curated jackets, shirts, dresses, trousers, and footwear at Storefront ComposeIt. Explore live stock by size and color with tracked delivery or complimentary boutique pickup.',
  alternates: {
    canonical: '/',
  },
  openGraph: {
    type: 'website',
    url: '/',
    title: 'Storefront ComposeIt — Curated Clothing & Footwear',
    description:
      'Shop curated jackets, shirts, dresses, trousers, and footwear at Storefront ComposeIt with live size availability and flexible delivery or boutique collection.',
  },
  twitter: {
    card: 'summary_large_image',
    title: 'Storefront ComposeIt — Curated Clothing & Footwear',
    description:
      'Shop curated jackets, shirts, dresses, trousers, and footwear at Storefront ComposeIt.',
  },
}

export default function HomePage() {
  return <HomeContentLayout />
}
