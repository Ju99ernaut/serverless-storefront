import { timingSafeEqual } from 'crypto'
import { createNeonAuth } from '@neon/auth/next/server'
import type { Order } from '../payload-types'
import { getServerPayload } from './payload-server'

export const neonAuth = createNeonAuth({
  baseUrl: process.env.NEON_AUTH_BASE_URL || 'http://localhost:3000/api/auth',
  cookies: {
    secret:
      process.env.DB_SECRET ||
      'default-storefront-payload-secret-key-at-least-32-chars',
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

export function verifyPaymentWebhookSecret(request: Request): boolean {
  const configuredSecret = process.env.PAYMENT_WEBHOOK_SECRET?.trim()
  if (!configuredSecret) return false

  const headerSecret = request.headers.get('x-payment-webhook-secret')?.trim()
  const authHeader = request.headers.get('authorization')?.trim()
  const bearerSecret = authHeader?.toLowerCase().startsWith('bearer ')
    ? authHeader.slice(7).trim()
    : undefined

  const provided = headerSecret || bearerSecret
  if (!provided) return false

  const expectedBuf = Buffer.from(configuredSecret)
  const providedBuf = Buffer.from(provided)
  if (expectedBuf.length !== providedBuf.length) return false

  return timingSafeEqual(expectedBuf, providedBuf)
}

export async function isAuthorizedPayloadAdminRequest(request: Request): Promise<boolean> {
  try {
    const payload = await getServerPayload()
    if (typeof (payload as { auth?: unknown }).auth !== 'function') {
      return false
    }
    const authResult = await payload.auth({ headers: request.headers })
    const role = (authResult?.user as { role?: string | null } | null | undefined)?.role
    return role === 'admin'
  } catch {
    return false
  }
}

export async function getServerNeonUser(): Promise<AuthenticatedNeonUser | null> {
  try {
    const { data: session } = await neonAuth.getSession()
    const user = session?.user
    if (!user?.id) {
      return null
    }
    return {
      id: String(user.id),
      email: String(user.email || '').trim().toLowerCase(),
      name: String(user.name || ''),
      role: (user as { role?: string | null }).role ?? null,
    }
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
