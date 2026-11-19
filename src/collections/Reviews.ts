import type { CollectionConfig } from 'payload'

export const Reviews: CollectionConfig = {
  slug: 'reviews',
  admin: {
    useAsTitle: 'title',
    defaultColumns: ['productSlug', 'authorName', 'rating', 'verifiedPurchase', 'createdAt'],
  },
  access: {
    read: () => true,
    create: () => true,
    update: () => true,
    delete: () => true,
  },
  fields: [
    {
      name: 'product',
      type: 'relationship',
      relationTo: 'products',
      index: true,
    },
    {
      name: 'productSlug',
      type: 'text',
      required: true,
      index: true,
    },
    {
      name: 'user',
      type: 'relationship',
      relationTo: 'users',
    },
    {
      name: 'neonUserId',
      type: 'text',
      index: true,
    },
    {
      name: 'authorName',
      type: 'text',
      required: true,
    },
    {
      name: 'authorEmail',
      type: 'text',
    },
    {
      name: 'rating',
      type: 'number',
      required: true,
      min: 1,
      max: 5,
    },
    {
      name: 'title',
      type: 'text',
      required: true,
    },
    {
      name: 'comment',
      type: 'textarea',
      required: true,
    },
    {
      name: 'variantSize',
      type: 'text',
    },
    {
      name: 'variantColor',
      type: 'text',
    },
    {
      name: 'verifiedPurchase',
      type: 'checkbox',
      defaultValue: false,
    },
  ],
}
