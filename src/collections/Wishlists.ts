import type { CollectionConfig } from 'payload'

export const Wishlists: CollectionConfig = {
  slug: 'wishlists',
  admin: {
    useAsTitle: 'neonUserId',
    defaultColumns: ['neonUserId', 'updatedAt'],
  },
  access: {
    read: () => true,
    create: () => true,
    update: () => true,
    delete: () => true,
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
