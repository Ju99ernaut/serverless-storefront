import type { ReactNode } from 'react'
import type { Metadata, Viewport } from 'next'
import NextTopLoader from 'nextjs-toploader'
import '../../styles/globals.css'
import '../../styles/filters.css'
import { ClientLayout } from '@/components/client-layout'
import { getSiteUrl } from '@/lib/og-image'

export const metadata: Metadata = {
  metadataBase: new URL(getSiteUrl()),
  applicationName: 'Storefront Atelier',
  title: {
    default: 'Storefront Atelier — Curated Clothing & Footwear',
    template: '%s — Storefront Atelier',
  },
  description:
    'Discover curated outerwear, tailored shirts, dresses, trousers, and footwear at Storefront Atelier. Live size availability, flexible delivery or boutique collection, and real-time order tracking.',
  openGraph: {
    type: 'website',
    siteName: 'Storefront Atelier',
    locale: 'en_US',
    title: 'Storefront Atelier — Curated Clothing & Footwear',
    description:
      'Discover curated outerwear, tailored shirts, dresses, trousers, and footwear at Storefront Atelier. Live size availability, flexible delivery or boutique collection, and real-time order tracking.',
  },
  twitter: {
    card: 'summary_large_image',
    title: 'Storefront Atelier — Curated Clothing & Footwear',
    description:
      'Discover curated outerwear, tailored shirts, dresses, trousers, and footwear at Storefront Atelier.',
  },
  manifest: '/manifest.json',
  icons: {
    icon: [
      { url: '/icons/icon-16x16.png', sizes: '16x16', type: 'image/png' },
      { url: '/icons/icon-32x32.png', sizes: '32x32', type: 'image/png' },
      { url: '/favicon.ico' },
    ],
    apple: '/icons/icon-192x192.png',
  },
}

export const viewport: Viewport = {
  themeColor: [
    { media: '(prefers-color-scheme: dark)', color: '#2A2B30' },
    { media: '(prefers-color-scheme: light)', color: '#F4F5FA' },
  ],
  width: 'device-width',
  initialScale: 1,
}

export default function RootLayout({ children }: { children: ReactNode }) {
  return (
    <html lang="en" className="flexbox no-touch" suppressHydrationWarning>
      <head>
        <meta name="color-scheme" content="light dark" />
      </head>
      <body>
        <NextTopLoader color="#5c5edc" showSpinner={false} />
        <ClientLayout>{children}</ClientLayout>
      </body>
    </html>
  )
}
