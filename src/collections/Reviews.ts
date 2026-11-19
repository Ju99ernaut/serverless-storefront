import type { CollectionAfterChangeHook, CollectionConfig } from 'payload'
import { enforceNeonUserIdOwnershipHook, reviewsAccess } from '../lib/access'

const syncProductRatingOnReviewChange: CollectionAfterChangeHook = async ({
  doc,
  operation,
  req,
}) => {
  if (operation !== 'create' || !req?.payload) {
    return doc
  }

  const productSlug = (doc as { productSlug?: string } | undefined)?.productSlug
  if (!productSlug) {
    return doc
  }

  try {
    const [productRes, reviewsRes] = await Promise.all([
      req.payload.find({
        collection: 'products',
        where: { slug: { equals: productSlug } },
        limit: 1,
        req,
      }),
      req.payload.find({
        collection: 'reviews',
        where: { productSlug: { equals: productSlug } },
        limit: 500,
        req,
      }),
    ])

    const product = productRes.docs?.[0]
    const allReviews = reviewsRes.docs || []
    if (product && allReviews.length > 0) {
      const totalCount = allReviews.length
      const avg = Number(
        (
          allReviews.reduce((sum, r) => sum + (Number(r.rating) || 0), 0) /
          totalCount
        ).toFixed(1),
      )

      await req.payload.update({
        collection: 'products',
        id: product.id,
        data: {
          reviewCount: totalCount,
          averageRating: avg,
        },
        overrideAccess: true,
        req,
      })
    }
  } catch (err) {
    req.payload.logger?.error?.({
      err,
      msg: `Failed to sync rating for product "${productSlug}"`,
    })
  }

  return doc
}

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
