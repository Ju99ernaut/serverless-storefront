'use client'

import {
  createContext,
  useCallback,
  useContext,
  useMemo,
  useState,
  type Dispatch,
  type ReactNode,
  type SetStateAction,
} from 'react'
import { useQueryClient } from '@tanstack/react-query'
import type { StoreUserRecord } from '../data/utils'
import { neonAuthClient } from '../lib/auth-client'
import type { AuthModalIntent } from './query-keys'

interface AuthContextValue {
  user: StoreUserRecord | null
  setUser: Dispatch<SetStateAction<StoreUserRecord | null>>
  isAuthModalOpen: boolean
  setIsAuthModalOpen: (open: boolean) => void
  authModalIntent: AuthModalIntent
  openAuthModal: (intent?: AuthModalIntent) => void
  signOut: () => void
}

const AuthContext = createContext<AuthContextValue | null>(null)

export function AuthProvider({ children }: { children: ReactNode }) {
  const queryClient = useQueryClient()
  const [user, setUser] = useState<StoreUserRecord | null>(null)
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
    setUser(null)
    queryClient.removeQueries({ queryKey: ['storefront-orders'] })
  }, [queryClient])

  const value = useMemo(
    () => ({
      user,
      setUser,
      isAuthModalOpen,
      setIsAuthModalOpen,
      authModalIntent,
      openAuthModal,
      signOut,
    }),
    [user, isAuthModalOpen, authModalIntent, openAuthModal, signOut],
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
