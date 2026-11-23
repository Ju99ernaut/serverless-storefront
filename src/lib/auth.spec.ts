import { describe, it, expect, vi, beforeEach } from 'vitest'
import {
  AUTHORIZED_FULFILLMENT_ROLES,
  canUserAccessOrder,
  getServerNeonUser,
  isAuthorizedAdminOrStaff,
  isAuthorizedOperator,
  isAuthorizedPayloadAdminRequest,
  type AuthenticatedNeonUser,
} from './auth'
import * as payloadServer from './payload-server'

describe('src/lib/auth unit tests', () => {
  describe('AUTHORIZED_FULFILLMENT_ROLES', () => {
    it('contains admin, staff, and fulfillment roles', () => {
      expect(AUTHORIZED_FULFILLMENT_ROLES.has('admin')).toBe(true)
      expect(AUTHORIZED_FULFILLMENT_ROLES.has('staff')).toBe(true)
      expect(AUTHORIZED_FULFILLMENT_ROLES.has('fulfillment')).toBe(true)
      expect(AUTHORIZED_FULFILLMENT_ROLES.has('customer')).toBe(false)
    })
  })

  describe('isAuthorizedAdminOrStaff and isAuthorizedOperator', () => {
    it('identifies admin, staff, and fulfillment as authorized operators', () => {
      const adminUser: AuthenticatedNeonUser = {
        id: 'u1',
        email: 'admin@example.com',
        name: 'Admin',
        role: 'admin',
      }
      const staffUser: AuthenticatedNeonUser = {
        id: 'u2',
        email: 'staff@example.com',
        name: 'Staff',
        role: 'staff',
      }
      const fulfillmentUser: AuthenticatedNeonUser = {
        id: 'u3',
        email: 'ful@example.com',
        name: 'Fulfillment',
        role: 'FULFILLMENT',
      }

      expect(isAuthorizedAdminOrStaff(adminUser)).toBe(true)
      expect(isAuthorizedAdminOrStaff(staffUser)).toBe(true)
      expect(isAuthorizedAdminOrStaff(fulfillmentUser)).toBe(true)
      expect(isAuthorizedOperator(adminUser)).toBe(true)
      expect(isAuthorizedOperator(staffUser)).toBe(true)
      expect(isAuthorizedOperator(fulfillmentUser)).toBe(true)
    })

    it('rejects customers or users without valid operator roles', () => {
      const customer: AuthenticatedNeonUser = {
        id: 'u4',
        email: 'cust@example.com',
        name: 'Customer',
        role: 'customer',
      }
      const noRoleUser: AuthenticatedNeonUser = {
        id: 'u5',
        email: 'norole@example.com',
        name: 'No Role',
        role: null,
      }

      expect(isAuthorizedAdminOrStaff(customer)).toBe(false)
      expect(isAuthorizedAdminOrStaff(noRoleUser)).toBe(false)
      expect(isAuthorizedAdminOrStaff(null)).toBe(false)
      expect(isAuthorizedOperator(customer)).toBe(false)
      expect(isAuthorizedOperator(noRoleUser)).toBe(false)
      expect(isAuthorizedOperator(null)).toBe(false)
      expect(isAuthorizedOperator(undefined as unknown as null)).toBe(false)
    })
  })

  describe('canUserAccessOrder', () => {
    const sampleOrder = {
      neonUserId: 'user_123',
      customerEmail: 'alex@example.com',
    }

    it('allows access if user is an authorized operator regardless of order ownership', () => {
      const admin: AuthenticatedNeonUser = {
        id: 'other_user',
        email: 'admin@store.com',
        name: 'Admin',
        role: 'admin',
      }
      expect(canUserAccessOrder(admin, sampleOrder)).toBe(true)
    })

    it('allows access if neonUserId matches order.neonUserId', () => {
      const owner: AuthenticatedNeonUser = {
        id: 'user_123',
        email: 'different@example.com',
        name: 'Owner',
        role: 'customer',
      }
      expect(canUserAccessOrder(owner, sampleOrder)).toBe(true)
    })

    it('allows access if email matches customerEmail (case-insensitive)', () => {
      const ownerByEmail: AuthenticatedNeonUser = {
        id: 'other_id',
        email: 'ALEX@EXAMPLE.COM',
        name: 'Alex',
        role: 'customer',
      }
      expect(canUserAccessOrder(ownerByEmail, sampleOrder)).toBe(true)
    })

    it('denies access if user is not operator and does not match id or email', () => {
      const stranger: AuthenticatedNeonUser = {
        id: 'stranger_id',
        email: 'stranger@example.com',
        name: 'Stranger',
        role: 'customer',
      }
      expect(canUserAccessOrder(stranger, sampleOrder)).toBe(false)
      expect(canUserAccessOrder(null, sampleOrder)).toBe(false)
    })
  })

  describe('isAuthorizedPayloadAdminRequest', () => {
    it('returns true when Payload auth succeeds with an operator role', async () => {
      const mockPayload = {
        auth: vi.fn().mockResolvedValue({
          user: { id: 1, email: 'admin@store.com', role: 'admin' },
        }),
      }
      vi.spyOn(payloadServer, 'getServerPayload').mockResolvedValue(mockPayload as never)

      const req = new Request('http://localhost:3000/api/storefront/orders', {
        headers: { Authorization: 'Bearer mock_admin_token' },
      })
      const isAuth = await isAuthorizedPayloadAdminRequest(req)
      expect(isAuth).toBe(true)
    })

    it('returns false when Payload auth returns customer or fails', async () => {
      const mockPayload = {
        auth: vi.fn().mockResolvedValue({
          user: { id: 2, email: 'customer@example.com', role: 'customer' },
        }),
      }
      vi.spyOn(payloadServer, 'getServerPayload').mockResolvedValue(mockPayload as never)

      const req = new Request('http://localhost:3000/api/storefront/orders')
      const isAuth = await isAuthorizedPayloadAdminRequest(req)
      expect(isAuth).toBe(false)
    })

    it('returns false when getServerPayload throws', async () => {
      vi.spyOn(payloadServer, 'getServerPayload').mockRejectedValueOnce(new Error('DB connection error'))

      const req = new Request('http://localhost:3000/api/storefront/orders')
      const isAuth = await isAuthorizedPayloadAdminRequest(req)
      expect(isAuth).toBe(false)
    })
  })

  describe('getServerNeonUser', () => {
    it('returns session user when authenticated', async () => {
      const user = await getServerNeonUser()
      // Current mock session user from vitest.setup.ts
      expect(user).toBeTruthy()
      expect(user?.email).toBe('alex.rivera@example.com')
    })
  })
})
