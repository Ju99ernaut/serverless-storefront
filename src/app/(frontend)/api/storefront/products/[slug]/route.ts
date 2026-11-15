import { NextRequest, NextResponse } from 'next/server';
import {
  getRuntimeStore,
  expireStaleReservations,
} from '@/lib/storefront-db';

export async function GET(
  _request: NextRequest,
  { params }: { params: Promise<{ slug: string }> }
) {
  expireStaleReservations();
  const { slug } = await params;
  const store = getRuntimeStore();

  const product = store.products.find(
    (p) => p.slug === slug || p.id === slug
  );

  if (!product) {
    return NextResponse.json({ error: 'Product not found' }, { status: 404 });
  }

  const reviews = store.reviews.filter(
    (r) => r.productSlug === product.slug || r.productSlug === product.id
  );

  const relatedProducts = store.products
    .filter((p) => p.category === product.category && p.id !== product.id)
    .slice(0, 4);

  return NextResponse.json({
    product,
    reviews,
    relatedProducts,
  });
}
