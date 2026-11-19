import type { CollectionConfig } from 'payload'
import { enforceNeonUserIdOwnershipHook, ownerByNeonUserIdAccess } from '../lib/access'

export const BillingDetails: CollectionConfig = {
  slug: 'billing-details',
  admin: {
    useAsTitle: 'neonUserId',
    defaultColumns: ['neonUserId', 'phone', 'updatedAt'],
  },
  access: ownerByNeonUserIdAccess,
  hooks: {
    beforeChange: [enforceNeonUserIdOwnershipHook],
  },
  fields: [
    {
      name: 'neonUserId',
      type: 'text',
      required: true,
      unique: true,
      index: true,
    },
    {
      name: 'phone',
      type: 'text',
    },
    {
      name: 'shippingAddress',
      type: 'textarea',
    },
  ],
}
