import { NextRequest, NextResponse } from 'next/server';
import {
  getRuntimeStore,
  expireStaleReservations,
} from '@/lib/storefront-db';

export async function GET(request: NextRequest) {
  expireStaleReservations();
  const store = getRuntimeStore();
  const { searchParams } = new URL(request.url);
  const q = (searchParams.get('q') || '').trim().toLowerCase();
  const filter = (searchParams.get('filter') || 'all').trim();
  const sort = (searchParams.get('sort') || 'featured').trim();

  let products = [...store.products];

  if (filter && filter !== 'all') {
    products = products.filter(
      (p) =>
        p.category === filter ||
        (Array.isArray(p.tags) && p.tags.includes(filter))
    );
  }

  if (q) {
    products = products.filter((p) => {
      const haystack = [
        p.title,
        p.brand,
        p.category,
        p.subcategory,
        p.material,
        p.fit,
        p.description,
        ...p.tags,
        ...p.variants.map((v) => `${v.color} ${v.size} ${v.sku}`),
      ]
        .join(' ')
        .toLowerCase();
      return haystack.includes(q);
    });
  }

  if (sort === 'price-asc') {
    products.sort((a, b) => a.price - b.price);
  } else if (sort === 'price-desc') {
    products.sort((a, b) => b.price - a.price);
  } else if (sort === 'rating') {
    products.sort((a, b) => b.averageRating - a.averageRating);
  }

  return NextResponse.json({
    products,
    banners: store.banners,
  });
}
