'use client'

import type { ReactNode } from 'react'
import { ThemeProvider } from './theme-provider'
import { StoreImageKitProvider } from './ui/optimized-image'
import { StoreProvider } from '../context'
import AuthModal from './auth-modal'
import ScrollToTopButton from './scroll-to-top-button'
import { QueryClient, QueryClientProvider } from '@tanstack/react-query'
import { Toaster } from '@/components/ui/toast'
import { ReactQueryDevtools } from '@tanstack/react-query-devtools'

const queryClient = new QueryClient()

export function ClientLayout({ children }: { children: ReactNode }) {
  return (
    <QueryClientProvider client={queryClient}>
      <ThemeProvider>
        <StoreImageKitProvider>
          <StoreProvider>
            <ScrollToTopButton />
            <AuthModal />
            <Toaster />
            {children}
          </StoreProvider>
        </StoreImageKitProvider>
      </ThemeProvider>
      <ReactQueryDevtools initialIsOpen={false} />
    </QueryClientProvider>
  )
}
