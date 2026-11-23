import { describe, it, expect, beforeEach } from 'vitest'
import {
  isAdminAccess,
  isPayloadAdmin,
  ordersAccess,
  ownerByNeonUserIdAccess,
  enforceNeonUserIdOwnershipHook,
  resolveRequestAuth,
  reviewsAccess,
  usersAccess,
} from '../access'
import type { PayloadRequest } from 'payload'

describe('src/lib/access unit tests', () => {
  const setSession = (
    user: { id: string; email: string; name: string; role?: string | null } | null,
  ) => {
    ;(
      globalThis as unknown as {
        __setMockNeonSessionUser__?: (u: typeof user) => void
      }
    ).__setMockNeonSessionUser__?.(user)
  }

  beforeEach(() => {
    setSession({
      id: 'neon_usr_alex',
      email: 'alex.rivera@example.com',
      name: 'Alex Rivera',
      role: 'customer',
    })
  })

  describe('isPayloadAdmin', () => {
    it('returns true for admin, staff, or fulfillment payload user', () => {
      expect(isPayloadAdmin({ user: { id: 1, role: 'admin' } } as unknown as PayloadRequest)).toBe(
        true,
      )
      expect(isPayloadAdmin({ user: { id: 2, role: 'staff' } } as unknown as PayloadRequest)).toBe(
        true,
      )
      expect(
        isPayloadAdmin({ user: { id: 3, role: 'fulfillment' } } as unknown as PayloadRequest),
      ).toBe(true)
    })

    it('returns false for customer or undefined', () => {
      expect(
        isPayloadAdmin({ user: { id: 4, role: 'customer' } } as unknown as PayloadRequest),
      ).toBe(false)
      expect(isPayloadAdmin(undefined)).toBe(false)
      expect(isPayloadAdmin({ user: null } as unknown as PayloadRequest)).toBe(false)
    })
  })

  describe('resolveRequestAuth and isAdminAccess', () => {
    it('resolves as admin/operator when payload user has admin role', async () => {
      const req = { user: { id: 1, role: 'admin' } } as unknown as PayloadRequest
      const auth = await resolveRequestAuth(req)
      expect(auth.isAdmin).toBe(true)
      expect(auth.isOperator).toBe(true)
      expect(await isAdminAccess({ req })).toBe(true)
    })

    it('resolves as operator when payload user has staff role', async () => {
      const req = { user: { id: 2, role: 'staff' } } as unknown as PayloadRequest
      const auth = await resolveRequestAuth(req)
      expect(auth.isAdmin).toBe(false)
      expect(auth.isOperator).toBe(true)
      expect(await isAdminAccess({ req })).toBe(true)
    })

    it('resolves as customer when user is regular neon session customer', async () => {
      const req = { user: null } as unknown as PayloadRequest
      const auth = await resolveRequestAuth(req)
      expect(auth.isAdmin).toBe(false)
      expect(auth.isOperator).toBe(false)
      expect(auth.neonUser?.id).toBe('neon_usr_alex')
      expect(await isAdminAccess({ req })).toBe(false)
    })
  })

  describe('ordersAccess', () => {
    it('allows full read/create/update/delete for authorized operators', async () => {
      const operatorReq = { user: { id: 1, role: 'admin' } } as unknown as PayloadRequest
      expect(await ordersAccess.read({ req: operatorReq })).toBe(true)
      expect(await ordersAccess.create({ req: operatorReq })).toBe(true)
      expect(await ordersAccess.update({ req: operatorReq })).toBe(true)
      expect(await ordersAccess.delete({ req: operatorReq })).toBe(true)
    })

    it('allows staff or fulfillment operators full access in Payload Admin', async () => {
      const staffReq = { user: { id: 2, role: 'fulfillment' } } as unknown as PayloadRequest
      expect(await ordersAccess.read({ req: staffReq })).toBe(true)
      expect(await ordersAccess.create({ req: staffReq })).toBe(true)
      expect(await ordersAccess.update({ req: staffReq })).toBe(true)
      expect(await ordersAccess.delete({ req: staffReq })).toBe(true)
    })

    it('filters orders by ownership (neonUserId or customerEmail) for customer session', async () => {
      const customerReq = { user: null } as unknown as PayloadRequest
      const readFilter = await ordersAccess.read({ req: customerReq })
      expect(readFilter).toEqual({
        or: [
          { neonUserId: { equals: 'neon_usr_alex' } },
          { customerEmail: { equals: 'alex.rivera@example.com' } },
        ],
      })
      // Customers cannot directly create or update orders via Payload API
      expect(await ordersAccess.create({ req: customerReq })).toBe(false)
      expect(await ordersAccess.update({ req: customerReq })).toBe(false)
      expect(await ordersAccess.delete({ req: customerReq })).toBe(false)
    })

    it('denies read access to completely unauthenticated requests', async () => {
      setSession(null)
      const unauthReq = { user: null } as unknown as PayloadRequest
      expect(await ordersAccess.read({ req: unauthReq })).toBe(false)
    })
  })

  describe('ownerByNeonUserIdAccess', () => {
    it('grants full access to admins', async () => {
      const adminReq = { user: { id: 1, role: 'admin' } } as unknown as PayloadRequest
      expect(await ownerByNeonUserIdAccess.read({ req: adminReq })).toBe(true)
      expect(
        await ownerByNeonUserIdAccess.create({ req: adminReq, data: { neonUserId: 'other' } }),
      ).toBe(true)
      expect(
        await ownerByNeonUserIdAccess.update({ req: adminReq, data: { neonUserId: 'other' } }),
      ).toBe(true)
      expect(await ownerByNeonUserIdAccess.delete({ req: adminReq })).toBe(true)
    })

    it('enforces neonUserId ownership for customer session', async () => {
      const customerReq = { user: null } as unknown as PayloadRequest
      expect(await ownerByNeonUserIdAccess.read({ req: customerReq })).toEqual({
        neonUserId: { equals: 'neon_usr_alex' },
      })
      expect(
        await ownerByNeonUserIdAccess.create({
          req: customerReq,
          data: { neonUserId: 'neon_usr_alex' },
        }),
      ).toBe(true)
      expect(
        await ownerByNeonUserIdAccess.create({
          req: customerReq,
          data: { neonUserId: 'someone_else' },
        }),
      ).toBe(false)
      expect(
        await ownerByNeonUserIdAccess.update({
          req: customerReq,
          data: { neonUserId: 'neon_usr_alex' },
        }),
      ).toEqual({
        neonUserId: { equals: 'neon_usr_alex' },
      })
      expect(
        await ownerByNeonUserIdAccess.update({
          req: customerReq,
          data: { neonUserId: 'someone_else' },
        }),
      ).toBe(false)
      expect(await ownerByNeonUserIdAccess.delete({ req: customerReq })).toEqual({
        neonUserId: { equals: 'neon_usr_alex' },
      })
    })

    it('denies access when unauthenticated', async () => {
      setSession(null)
      const unauthReq = { user: null } as unknown as PayloadRequest
      expect(await ownerByNeonUserIdAccess.read({ req: unauthReq })).toBe(false)
      expect(await ownerByNeonUserIdAccess.create({ req: unauthReq })).toBe(false)
      expect(await ownerByNeonUserIdAccess.delete({ req: unauthReq })).toBe(false)
    })
  })

  describe('enforceNeonUserIdOwnershipHook', () => {
    it('sets neonUserId from session for customer creations/updates', async () => {
      const customerReq = { user: null } as unknown as PayloadRequest
      const result = await enforceNeonUserIdOwnershipHook({
        collection: { slug: 'carts' } as never,
        context: {},
        data: { items: [] },
        operation: 'create',
        req: customerReq,
      })
      expect(result).toEqual({ items: [], neonUserId: 'neon_usr_alex' })
    })

    it('preserves existing data when admin operates', async () => {
      const adminReq = { user: { id: 1, role: 'admin' } } as unknown as PayloadRequest
      const result = await enforceNeonUserIdOwnershipHook({
        collection: { slug: 'carts' } as never,
        context: {},
        data: { items: [], neonUserId: 'custom_user' },
        operation: 'create',
        req: adminReq,
      })
      expect(result).toEqual({ items: [], neonUserId: 'custom_user' })
    })
  })

  describe('reviewsAccess and usersAccess', () => {
    it('reviews read is public', async () => {
      expect(reviewsAccess.read({ req: {} as never })).toBe(true)
    })

    it('users access allows admin full access', () => {
      const adminReq = { user: { id: 1, role: 'admin' } } as unknown as PayloadRequest
      expect(usersAccess.read({ req: adminReq })).toBe(true)
      expect(usersAccess.update({ req: adminReq })).toBe(true)
    })

    it('users access restricts customer to their own user id', () => {
      const userReq = { user: { id: 42, role: 'customer' } } as unknown as PayloadRequest
      expect(usersAccess.read({ req: userReq })).toEqual({ id: { equals: 42 } })
      expect(usersAccess.update({ req: userReq })).toEqual({ id: { equals: 42 } })
    })
  })
})
