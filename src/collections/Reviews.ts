import type { CollectionConfig } from 'payload'
import { enforceNeonUserIdOwnershipHook, reviewsAccess } from '../lib/access'
import { syncProductRatingOnReviewChange } from './hooks/sync-product-on-rating-change'

export const Reviews: CollectionConfig = {
  slug: 'reviews',
  admin: {
    useAsTitle: 'title',
    defaultColumns: ['productSlug', 'authorName', 'rating', 'verifiedPurchase', 'createdAt'],
  },
  access: reviewsAccess,
  hooks: {
    beforeChange: [enforceNeonUserIdOwnershipHook],
    afterChange: [syncProductRatingOnReviewChange],
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
