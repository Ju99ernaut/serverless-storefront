'use client'

import { createAuthClient } from '@neon/auth/next'

/**
 * Neon Managed Better Auth React client (@neondatabase/auth/next).
 * Interfaces with `/api/auth/[...path]` proxy route backed by Neon Auth.
 */
export const neonAuthClient = createAuthClient()
