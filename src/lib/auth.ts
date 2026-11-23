import { createNeonAuth } from '@neon/auth/next/server'
import type { Order } from '../payload-types'
import { getServerPayload } from './payload-server'

export const neonAuth = createNeonAuth({
  baseUrl: process.env.NEON_AUTH_BASE_URL!,
  cookies: {
    secret: process.env.DB_SECRET!,
  },
  logLevel: 'silent',
})

export interface AuthenticatedNeonUser {
  id: string
  email: string
  name: string
  role?: string | null
}

export const AUTHORIZED_FULFILLMENT_ROLES = new Set(['admin', 'staff', 'fulfillment'])

export function isAuthorizedAdminOrStaff(user: AuthenticatedNeonUser | null): boolean {
  if (!user?.role) return false
  return AUTHORIZED_FULFILLMENT_ROLES.has(user.role.trim().toLowerCase())
}

export async function isAuthorizedPayloadAdminRequest(request: Request): Promise<boolean> {
  try {
    const payload = await getServerPayload()
    const authResult = await payload.auth({ headers: request.headers })
    const role = authResult?.user?.role
    return role === 'admin'
  } catch {
    return false
  }
}

export async function getServerNeonUser(): Promise<AuthenticatedNeonUser | null> {
  try {
    const { data: session } = await neonAuth.getSession()
    const user = session?.user
    if (!user) {
      return null
    }
    return user
  } catch {
    return null
  }
}

export function canUserAccessOrder(
  user: AuthenticatedNeonUser | null,
  order: Pick<Order, 'neonUserId' | 'customerEmail'>,
): boolean {
  if (!user) return false
  if (isAuthorizedAdminOrStaff(user)) return true
  if (order.neonUserId && order.neonUserId === user.id) return true
  if (
    order.customerEmail &&
    user.email &&
    order.customerEmail.trim().toLowerCase() === user.email
  ) {
    return true
  }
  return false
}
