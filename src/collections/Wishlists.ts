import type { CollectionConfig } from 'payload'
import { enforceNeonUserIdOwnershipHook, ownerByNeonUserIdAccess } from '../lib/access'

export const Wishlists: CollectionConfig = {
  slug: 'wishlists',
  admin: {
    useAsTitle: 'neonUserId',
    defaultColumns: ['neonUserId', 'updatedAt'],
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
      name: 'items',
      type: 'array',
      fields: [
        {
          name: 'product',
          type: 'relationship',
          relationTo: 'products',
        },
        {
          name: 'productSlug',
          type: 'text',
          required: true,
        },
      ],
    },
  ],
}
