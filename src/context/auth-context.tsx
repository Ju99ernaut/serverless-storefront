'use client'

import {
  createContext,
  useCallback,
  useContext,
  useEffect,
  useMemo,
  useState,
  type Dispatch,
  type ReactNode,
  type SetStateAction,
} from 'react'
import { useQueryClient } from '@tanstack/react-query'
import type { NeonUser } from '../lib/utils/data'
import { neonAuthClient } from '../lib/auth-client'
import type { AuthModalIntent } from './query-keys'

interface AuthContextValue {
  user: NeonUser | null
  setUser: Dispatch<SetStateAction<NeonUser | null>>
  isAuthModalOpen: boolean
  setIsAuthModalOpen: (open: boolean) => void
  authModalIntent: AuthModalIntent
  openAuthModal: (intent?: AuthModalIntent) => void
  signOut: () => void
}

const AuthContext = createContext<AuthContextValue | null>(null)

function mapSessionUser(raw: {
  id: string
  email: string
  name: string
  role?: string | null
  image?: string | null
  emailVerified?: boolean
  createdAt?: Date | string
  updatedAt?: Date | string
}): NeonUser {
  return {
    id: raw.id,
    email: raw.email,
    name: raw.name,
    role: raw.role ?? null,
    image: raw.image ?? null,
    emailVerified: raw.emailVerified,
    createdAt: raw.createdAt,
    updatedAt: raw.updatedAt,
  }
}

export function AuthProvider({ children }: { children: ReactNode }) {
  const queryClient = useQueryClient()
  const { data: sessionData, isPending: isSessionPending } = neonAuthClient.useSession()
  const [user, setUser] = useState<NeonUser | null>(null)
  const [isAuthModalOpen, setIsAuthModalOpen] = useState(false)
  const [authModalIntent, setAuthModalIntent] = useState<AuthModalIntent>('account')

  useEffect(() => {
    if (isSessionPending) return
    if (sessionData?.user) {
      setUser(mapSessionUser(sessionData.user))
    } else {
      setUser(null)
    }
  }, [sessionData, isSessionPending])

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
    queryClient.removeQueries({ queryKey: ['storefront-billing-details'] })
    queryClient.removeQueries({ queryKey: ['storefront-cart'] })
    queryClient.removeQueries({ queryKey: ['storefront-wishlist'] })
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
