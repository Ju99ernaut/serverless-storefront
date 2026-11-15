import { NextRequest, NextResponse } from 'next/server';
import {
  getRuntimeStore,
  getPayloadIfAvailable,
} from '@/lib/storefront-db';

export async function POST(
  request: NextRequest,
  { params }: { params: Promise<{ slug: string }> }
) {
  const { slug } = await params;
  const body = await request.json();
  const store = getRuntimeStore();

  const product = store.products.find(
    (p) => p.slug === slug || p.id === slug
  );

  if (!product) {
    return NextResponse.json({ error: 'Product not found' }, { status: 404 });
  }

  const rating = Math.min(5, Math.max(1, Number(body.rating) || 5));
  const title = String(body.title || '').trim();
  const comment = String(body.comment || '').trim();
  const authorName = String(body.authorName || 'Verified Shopper').trim();

  if (!title || !comment) {
    return NextResponse.json(
      { error: 'Please provide both a review headline and your feedback.' },
      { status: 400 }
    );
  }

  const hasOrderedProduct = store.orders.some(
    (o) =>
      body.authorEmail &&
      o.customerEmail.toLowerCase() === String(body.authorEmail).toLowerCase() &&
      o.items.some(
        (i) => i.productSlug === product.slug || i.productId === product.id
      )
  );

  const newReview = {
    id: `rev_${Date.now()}`,
    productSlug: product.slug,
    authorName,
    authorEmail: body.authorEmail,
    rating,
    title,
    comment,
    variantSize: body.variantSize || 'M',
    variantColor: body.variantColor || product.variants[0]?.color || 'Signature',
    verifiedPurchase: hasOrderedProduct || true,
    createdAt: new Date().toISOString(),
  };

  store.reviews.unshift(newReview);

  const productReviews = store.reviews.filter(
    (r) => r.productSlug === product.slug
  );
  const totalCount = product.reviewCount + 1;
  const nextAvg = Number(
    (
      (product.averageRating * product.reviewCount + rating) /
      totalCount
    ).toFixed(1)
  );
  product.reviewCount = totalCount;
  product.averageRating = nextAvg;

  const payload = await getPayloadIfAvailable();
  if (payload) {
    await payload
      .create({
        collection: 'reviews',
        data: {
          productSlug: newReview.productSlug,
          authorName: newReview.authorName,
          authorEmail: newReview.authorEmail,
          rating: newReview.rating,
          title: newReview.title,
          comment: newReview.comment,
          variantSize: newReview.variantSize,
          variantColor: newReview.variantColor,
          verifiedPurchase: newReview.verifiedPurchase,
        },
      })
      .catch(() => {});
  }

  return NextResponse.json({
    review: newReview,
    product,
    reviews: productReviews,
  });
}
