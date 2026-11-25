import type { CollectionAfterChangeHook } from 'payload'

export const syncProductRatingOnReviewChange: CollectionAfterChangeHook = async ({
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
        (allReviews.reduce((sum, r) => sum + (Number(r.rating) || 0), 0) / totalCount).toFixed(1),
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
