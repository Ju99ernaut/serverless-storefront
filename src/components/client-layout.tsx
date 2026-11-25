'use client'

import type { ReactNode } from 'react'
import { ThemeProvider } from './theme-provider'
import { StoreProvider } from '../context'
import AuthModal from './auth-modal'
import ScrollToTopButton from './scroll-to-top-button'
import { QueryClient, QueryClientProvider } from '@tanstack/react-query'
import { Toaster } from '@/components/ui/toast'
import { ReactQueryDevtools } from '@tanstack/react-query-devtools'
import { ImageKitProvider } from '@imagekit/next'

const queryClient = new QueryClient()

export function ClientLayout({ children }: { children: ReactNode }) {
  return (
    <QueryClientProvider client={queryClient}>
      <ThemeProvider>
        <ImageKitProvider urlEndpoint={process.env.NEXT_PUBLIC_IMAGEKIT_URL}>
          <StoreProvider>
            <ScrollToTopButton />
            {children}
            <Toaster />
            <AuthModal />
          </StoreProvider>
        </ImageKitProvider>
      </ThemeProvider>
      <ReactQueryDevtools initialIsOpen={false} />
    </QueryClientProvider>
  )
}
