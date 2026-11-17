import type { ReactNode } from 'react'
import type { Metadata, Viewport } from 'next'
import '../../styles/globals.css'
import '../../styles/sidebar.css'
import { ClientLayout } from '@/components/client-layout'

export const metadata: Metadata = {
  title: 'Storefront Atelier — Curated Clothing & Footwear',
  description:
    'Modern clothing storefront powered by Payload CMS, Cloudflare R2, ImageKit, Neon Managed Better Auth, and Workflow SDK durable stock tracking.',
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
        <ClientLayout>{children}</ClientLayout>
      </body>
    </html>
  )
}
