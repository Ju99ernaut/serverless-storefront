'use client'

import { createContext, useCallback, useContext, useMemo, useState, type ReactNode } from 'react'
import { useQueryClient } from '@tanstack/react-query'
import { neonAuthClient } from '../lib/auth-client'
import type { AuthModalIntent } from './query-keys'

interface AuthContextValue {
  isAuthModalOpen: boolean
  setIsAuthModalOpen: (open: boolean) => void
  authModalIntent: AuthModalIntent
  openAuthModal: (intent?: AuthModalIntent) => void
  signOut: () => void
}

const AuthContext = createContext<AuthContextValue | null>(null)

export function AuthProvider({ children }: { children: ReactNode }) {
  const queryClient = useQueryClient()
  const [isAuthModalOpen, setIsAuthModalOpen] = useState(false)
  const [authModalIntent, setAuthModalIntent] = useState<AuthModalIntent>('account')

  const openAuthModal = useCallback((intent: AuthModalIntent = 'account') => {
    setAuthModalIntent(intent)
    setIsAuthModalOpen(true)
  }, [])

  const signOut = useCallback(() => {
    try {
      neonAuthClient.signOut().catch(() => {})
    } catch {}
    queryClient.removeQueries({ queryKey: ['storefront-orders'] })
    queryClient.removeQueries({ queryKey: ['storefront-billing-details'] })
    queryClient.removeQueries({ queryKey: ['storefront-cart'] })
    queryClient.removeQueries({ queryKey: ['storefront-wishlist'] })
  }, [queryClient])

  const value = useMemo(
    () => ({
      isAuthModalOpen,
      setIsAuthModalOpen,
      authModalIntent,
      openAuthModal,
      signOut,
    }),
    [isAuthModalOpen, authModalIntent, openAuthModal, signOut],
  )

  return <AuthContext.Provider value={value}>{children}</AuthContext.Provider>
}

export function useAuth() {
  const ctx = useContext(AuthContext)
  if (!ctx) {
    throw new Error('useAuth must be used within an AuthProvider')
  }
  return ctx
}
