import type { Access, CollectionBeforeChangeHook, PayloadRequest, Where } from 'payload'
import {
  AUTHORIZED_FULFILLMENT_ROLES,
  getServerNeonUser,
  isAuthorizedAdminOrStaff,
  isAuthorizedOperator,
  type AuthenticatedNeonUser,
} from './auth'

export function isPayloadAdmin(req: PayloadRequest | undefined) {
  const role = req?.user?.role
  return Boolean(role && AUTHORIZED_FULFILLMENT_ROLES.has(role.trim().toLowerCase()))
}

export { isAuthorizedOperator }

export async function resolveRequestAuth(req: PayloadRequest | undefined): Promise<{
  isAdmin: boolean
  isOperator: boolean
  neonUser: AuthenticatedNeonUser | null
}> {
  if (isPayloadAdmin(req)) {
    const role = req?.user?.role?.trim().toLowerCase()
    return { isAdmin: role === 'admin', isOperator: true, neonUser: null }
  }
  const neonUser = await getServerNeonUser()
  const isOperator = isAuthorizedAdminOrStaff(neonUser)
  if (neonUser?.role === 'admin' || isOperator) {
    return { isAdmin: neonUser?.role === 'admin', isOperator: true, neonUser }
  }
  return { isAdmin: false, isOperator: false, neonUser }
}

export const isAdminAccess: Access = async ({ req }) => {
  const { isAdmin, isOperator } = await resolveRequestAuth(req)
  return isAdmin || isOperator
}

export const ownerByNeonUserIdAccess: {
  read: Access
  create: Access
  update: Access
  delete: Access
} = {
  read: async ({ req }) => {
    const { isAdmin, neonUser } = await resolveRequestAuth(req)
    if (isAdmin) return true
    if (!neonUser) return false
    return {
      neonUserId: {
        equals: neonUser.id,
      },
    } satisfies Where
  },
  create: async ({ req, data }) => {
    const { isAdmin, neonUser } = await resolveRequestAuth(req)
    if (isAdmin) return true
    if (!neonUser) return false
    const requestedOwner = (data as { neonUserId?: string } | undefined)?.neonUserId
    return Boolean(!requestedOwner || requestedOwner === neonUser.id)
  },
  update: async ({ req, data }) => {
    const { isAdmin, neonUser } = await resolveRequestAuth(req)
    if (isAdmin) return true
    if (!neonUser) return false
    const requestedOwner = (data as { neonUserId?: string } | undefined)?.neonUserId
    if (requestedOwner && requestedOwner !== neonUser.id) {
      return false
    }
    return {
      neonUserId: {
        equals: neonUser.id,
      },
    } satisfies Where
  },
  delete: async ({ req }) => {
    const { isAdmin, neonUser } = await resolveRequestAuth(req)
    if (isAdmin) return true
    if (!neonUser) return false
    return {
      neonUserId: {
        equals: neonUser.id,
      },
    } satisfies Where
  },
}

export const enforceNeonUserIdOwnershipHook: CollectionBeforeChangeHook = async ({
  data,
  operation,
  req,
}) => {
  if ((operation !== 'create' && operation !== 'update') || !data) {
    return data
  }
  if (isPayloadAdmin(req)) {
    return data
  }
  const neonUser = await getServerNeonUser()
  if (neonUser && neonUser.role !== 'admin') {
    return {
      ...data,
      neonUserId: neonUser.id,
    }
  }
  return data
}

export const ordersAccess: {
  read: Access
  create: Access
  update: Access
  delete: Access
} = {
  read: async ({ req }) => {
    const { isAdmin, isOperator, neonUser } = await resolveRequestAuth(req)
    if (isAdmin || isOperator) return true
    if (!neonUser) return false
    if (neonUser.email) {
      const ownerWhere: Where = {
        or: [
          { neonUserId: { equals: neonUser.id } },
          { customerEmail: { equals: neonUser.email } },
        ],
      }
      return ownerWhere
    }
    const idOnlyWhere: Where = {
      neonUserId: {
        equals: neonUser.id,
      },
    }
    return idOnlyWhere
  },
  create: isAdminAccess,
  update: isAdminAccess,
  delete: isAdminAccess,
}

export const reviewsAccess: {
  read: Access
  create: Access
  update: Access
  delete: Access
} = {
  read: () => true,
  create: async ({ req, data }) => {
    const { isAdmin, neonUser } = await resolveRequestAuth(req)
    if (isAdmin) return true
    if (!neonUser) return false
    const requestedOwner = (data as { neonUserId?: string } | undefined)?.neonUserId
    return Boolean(!requestedOwner || requestedOwner === neonUser.id)
  },
  update: async ({ req, data }) => {
    const { isAdmin, neonUser } = await resolveRequestAuth(req)
    if (isAdmin) return true
    if (!neonUser) return false
    const requestedOwner = (data as { neonUserId?: string } | undefined)?.neonUserId
    if (requestedOwner && requestedOwner !== neonUser.id) {
      return false
    }
    return {
      neonUserId: {
        equals: neonUser.id,
      },
    } satisfies Where
  },
  delete: async ({ req }) => {
    const { isAdmin, neonUser } = await resolveRequestAuth(req)
    if (isAdmin) return true
    if (!neonUser) return false
    return {
      neonUserId: {
        equals: neonUser.id,
      },
    } satisfies Where
  },
}

export const usersAccess: {
  read: Access
  create: Access
  update: Access
  delete: Access
} = {
  read: ({ req }) => {
    if (isPayloadAdmin(req)) return true
    if (req.user) {
      return {
        id: {
          equals: req.user.id,
        },
      } satisfies Where
    }
    return false
  },
  create: isAdminAccess,
  update: ({ req }) => {
    if (isPayloadAdmin(req)) return true
    if (req.user) {
      return {
        id: {
          equals: req.user.id,
        },
      } satisfies Where
    }
    return false
  },
  delete: isAdminAccess,
}
