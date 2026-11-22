import type { Access, CollectionBeforeChangeHook, PayloadRequest, Where } from 'payload'
import { getServerNeonUser, type AuthenticatedNeonUser } from './auth'

export function isPayloadAdmin(req: PayloadRequest | undefined) {
  return req?.user?.role === 'admin'
}

export async function resolveRequestAuth(req: PayloadRequest | undefined): Promise<{
  isAdmin: boolean
  neonUser: AuthenticatedNeonUser | null
}> {
  if (isPayloadAdmin(req)) {
    return { isAdmin: true, neonUser: null }
  }
  const neonUser = await getServerNeonUser()
  if (neonUser?.role === 'admin') {
    return { isAdmin: true, neonUser }
  }
  return { isAdmin: false, neonUser }
}

export const isAdminAccess: Access = async ({ req }) => {
  const { isAdmin } = await resolveRequestAuth(req)
  return isAdmin
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
    const { isAdmin, neonUser } = await resolveRequestAuth(req)
    if (isAdmin) return true
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
