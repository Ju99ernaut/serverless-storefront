import type { BasePayload } from 'payload';
import {
  PRODUCTS,
  HOME_BANNERS,
  INITIAL_REVIEWS,
  Product,
  ProductVariant,
  ProductReviewItem,
  BannerSlide,
  CartLineItem,
  PaymentOptionType,
} from '../data/products';

export interface StoreUserRecord {
  id: string;
  email: string;
  name: string;
  phone?: string;
  role: 'customer' | 'admin';
  neonAuthUserId?: string;
  authProvider: 'neon' | 'google' | 'local';
  avatarUrl?: string;
  passwordHash?: string;
  shippingAddresses: Array<{
    id: string;
    label: string;
    fullName: string;
    streetAddress: string;
    city?: string;
    postalCode?: string;
    country?: string;
    phone?: string;
    isDefault?: boolean;
  }>;
  wishlistProductSlugs: string[];
  savedCart: CartLineItem[];
  createdAt: string;
}

export interface StoreOrderRecord {
  id: string;
  orderId: string;
  invoiceNumber: string;
  receiptNumber: string;
  userId?: string;
  customerEmail: string;
  customerName: string;
  customerPhone?: string;
  shippingAddress?: string;
  collectionLocation?: string;
  paymentOption: PaymentOptionType;
  paymentMethodLabel: string;
  fulfillmentMethod: 'DELIVERY' | 'COLLECTION';
  paymentStatus: 'PENDING' | 'PAID' | 'FAILED' | 'REFUNDED';
  orderStatus:
    | 'PENDING'
    | 'CONFIRMED'
    | 'PROCESSING'
    | 'READY_FOR_COLLECTION'
    | 'OUT_FOR_DELIVERY'
    | 'COMPLETED'
    | 'CANCELLED';
  cardLast4: string;
  paidAt?: string;
  issuedAt: string;
  items: Array<{
    productId: string;
    productSlug: string;
    variantSku: string;
    title: string;
    brand: string;
    category: string;
    subcategory: string;
    size: string;
    color: string;
    quantity: number;
    unitPrice: number;
    lineTotal: number;
    imageUrl: string;
  }>;
  totals: {
    subTotal: number;
    tax: number;
    shipping: number;
    grandTotal: number;
  };
  documents: {
    invoiceFilename?: string;
    invoiceTemplateId?: string;
    invoicePdfUrl?: string;
    receiptFilename?: string;
    receiptTemplateId?: string;
    receiptPdfUrl?: string;
    emailStatus?: string;
    emailMessageId?: string;
    emailPreviewUrl?: string | null;
    emailTemplateId?: string;
    renderedHtml?: string;
    payloadPreviewJson?: unknown;
  };
  statusTimeline: Array<{
    status: string;
    label: string;
    timestamp: string;
    note?: string;
    emailSent?: boolean;
  }>;
}

export interface StockReservationRecord {
  id: string;
  reservationKey: string;
  orderId?: string;
  status: 'RESERVED' | 'COMMITTED' | 'RELEASED' | 'EXPIRED';
  expiresAt: string;
  createdAt: string;
  items: Array<{
    productSlug: string;
    variantSku: string;
    quantity: number;
  }>;
  failureReason?: string;
}

interface RuntimeStoreState {
  products: Product[];
  banners: BannerSlide[];
  reviews: ProductReviewItem[];
  users: StoreUserRecord[];
  orders: StoreOrderRecord[];
  reservations: Map<string, StockReservationRecord>;
  activeLocks: Set<string>;
  payloadSeeded: boolean;
}

const globalForStore = globalThis as unknown as {
  __THE_STORE_RUNTIME__?: RuntimeStoreState;
};

function createInitialRuntimeState(): RuntimeStoreState {
  return {
    products: structuredClone(PRODUCTS),
    banners: structuredClone(HOME_BANNERS),
    reviews: structuredClone(INITIAL_REVIEWS),
    users: [
      {
        id: 'usr-demo-1',
        email: 'alex.rivera@example.com',
        name: 'Alex Rivera',
        phone: '+1 (415) 555-0192',
        role: 'customer',
        authProvider: 'neon',
        shippingAddresses: [
          {
            id: 'addr-1',
            label: 'Home',
            fullName: 'Alex Rivera',
            streetAddress: '742 Evergreen Terrace, Suite 200',
            city: 'San Francisco, CA',
            postalCode: '94107',
            country: 'United States',
            phone: '+1 (415) 555-0192',
            isDefault: true,
          },
        ],
        wishlistProductSlugs: [
          'moto-full-grain-biker-jacket',
          'silk-charmeuse-evening-gown',
        ],
        savedCart: [],
        createdAt: '2026-10-01T10:00:00.000Z',
      },
    ],
    orders: [],
    reservations: new Map(),
    activeLocks: new Set(),
    payloadSeeded: false,
  };
}

export function getRuntimeStore(): RuntimeStoreState {
  if (!globalForStore.__THE_STORE_RUNTIME__) {
    globalForStore.__THE_STORE_RUNTIME__ = createInitialRuntimeState();
  }
  return globalForStore.__THE_STORE_RUNTIME__;
}

export function isLivePostgresConfigured(): boolean {
  const url = process.env.POSTGRES_URL || process.env.DATABASE_URL || '';
  if (!url || url.includes('<password>') || url.includes('your-database-name')) {
    return false;
  }
  return url.startsWith('postgres://') || url.startsWith('postgresql://');
}

const runtimeDynamicImport = new Function(
  'specifier',
  'return import(specifier);'
) as (specifier: string) => Promise<Record<string, unknown>>;

export async function getPayloadIfAvailable(): Promise<BasePayload | null> {
  if (!isLivePostgresConfigured()) return null;
  try {
    const [{ getPayload }, configModule] = await Promise.all([
      runtimeDynamicImport('payload') as Promise<{
        getPayload: (args: { config: unknown }) => Promise<BasePayload>;
      }>,
      import('@payload-config'),
    ]);
    const payload = await getPayload({ config: configModule.default });
    const store = getRuntimeStore();
    if (!store.payloadSeeded) {
      store.payloadSeeded = true;
      await seedPayloadIfEmpty(payload).catch(() => {});
    }
    return payload;
  } catch {
    return null;
  }
}

async function seedPayloadIfEmpty(payload: BasePayload) {
  const existing = await payload.count({ collection: 'products' });
  if (existing.totalDocs > 0) return;

  for (const prod of PRODUCTS) {
    await payload.create({
      collection: 'products',
      data: {
        slug: prod.slug,
        legacyId: prod.id,
        title: prod.title,
        brand: prod.brand,
        price: prod.price,
        compareAtPrice: prod.compareAtPrice,
        category: prod.category,
        subcategory: prod.subcategory,
        tags: prod.tags.map((tag) => ({ tag })),
        size: prod.size,
        description: prod.description,
        material: prod.material,
        fit: prod.fit,
        care: prod.care,
        images: prod.images.map((url, idx) => ({
          url,
          alt: `${prod.title} view ${idx + 1}`,
        })),
        variants: prod.variants.map((v) => ({
          sku: v.sku,
          size: v.size,
          color: v.color,
          colorHex: v.colorHex,
          priceOverride: v.priceOverride,
          stock: v.stock,
          reservedStock: v.reservedStock,
          lowStockThreshold: v.lowStockThreshold,
          imageUrl: v.imageUrl,
        })),
        averageRating: prod.averageRating,
        reviewCount: prod.reviewCount,
      },
    });
  }

  for (let i = 0; i < HOME_BANNERS.length; i++) {
    const b = HOME_BANNERS[i];
    await payload.create({
      collection: 'banners',
      data: {
        title: b.title,
        subtitle: b.subtitle,
        badgeText: b.badgeText,
        imageUrl: b.imageUrl,
        ctaText: b.ctaText,
        ctaFilter: b.ctaFilter,
        ctaProductSlug: b.ctaProductSlug,
        accentColor: b.accentColor,
        active: true,
        sortOrder: i,
      },
    });
  }
}

/**
 * Concurrency-safe stock reservation helper.
 * Prevents double allocation across concurrent checkouts and expires stale locks.
 */
export function expireStaleReservations() {
  const store = getRuntimeStore();
  const now = Date.now();
  for (const [, res] of store.reservations.entries()) {
    if (res.status === 'RESERVED' && new Date(res.expiresAt).getTime() <= now) {
      res.status = 'EXPIRED';
      for (const item of res.items) {
        const prod = store.products.find(
          (p) => p.slug === item.productSlug || p.id === item.productSlug
        );
        const variant = prod?.variants.find((v) => v.sku === item.variantSku);
        if (variant) {
          variant.reservedStock = Math.max(0, variant.reservedStock - item.quantity);
        }
      }
    }
  }
}

export function reserveVariantStockAtomic(params: {
  reservationKey: string;
  orderId: string;
  items: Array<{
    productSlug: string;
    variantSku: string;
    quantity: number;
  }>;
}): {
  success: boolean;
  error?: string;
  reservation?: StockReservationRecord;
  insufficientItems?: Array<{
    variantSku: string;
    requested: number;
    available: number;
  }>;
} {
  expireStaleReservations();
  const store = getRuntimeStore();

  // Idempotency check: if already reserved for this key, return existing reservation
  const existing = store.reservations.get(params.reservationKey);
  if (existing && existing.status === 'RESERVED') {
    return { success: true, reservation: existing };
  }

  // Acquire per-SKU lock check to prevent concurrent double allocation
  for (const item of params.items) {
    if (store.activeLocks.has(item.variantSku)) {
      return {
        success: false,
        error: `SKU ${item.variantSku} is currently locked by another concurrent checkout. Please retry.`,
      };
    }
  }

  try {
    for (const item of params.items) {
      store.activeLocks.add(item.variantSku);
    }

    const insufficient: Array<{
      variantSku: string;
      requested: number;
      available: number;
    }> = [];

    const resolvedVariants: Array<{
      variant: ProductVariant;
      quantity: number;
      productSlug: string;
    }> = [];

    for (const reqItem of params.items) {
      const product = store.products.find(
        (p) => p.slug === reqItem.productSlug || p.id === reqItem.productSlug
      );
      if (!product) {
        return {
          success: false,
          error: `Product "${reqItem.productSlug}" not found.`,
        };
      }

      const variant =
        product.variants.find((v) => v.sku === reqItem.variantSku) ||
        product.variants[0];

      if (!variant) {
        return {
          success: false,
          error: `Variant "${reqItem.variantSku}" not found for ${product.title}.`,
        };
      }

      const available = Math.max(0, variant.stock - variant.reservedStock);
      if (available < reqItem.quantity) {
        insufficient.push({
          variantSku: variant.sku,
          requested: reqItem.quantity,
          available,
        });
      } else {
        resolvedVariants.push({
          variant,
          quantity: reqItem.quantity,
          productSlug: product.slug,
        });
      }
    }

    if (insufficient.length > 0) {
      const detail = insufficient
        .map(
          (i) =>
            `${i.variantSku} (requested ${i.requested}, only ${i.available} available)`
        )
        .join(', ');
      return {
        success: false,
        error: `Insufficient stock for: ${detail}`,
        insufficientItems: insufficient,
      };
    }

    // All items verified available — atomically increment reservedStock
    for (const entry of resolvedVariants) {
      entry.variant.reservedStock += entry.quantity;
    }

    const now = new Date();
    const expiresAt = new Date(now.getTime() + 15 * 60 * 1000).toISOString();
    const reservation: StockReservationRecord = {
      id: `res_${Date.now()}_${Math.random().toString(36).slice(2, 7)}`,
      reservationKey: params.reservationKey,
      orderId: params.orderId,
      status: 'RESERVED',
      createdAt: now.toISOString(),
      expiresAt,
      items: resolvedVariants.map((rv) => ({
        productSlug: rv.productSlug,
        variantSku: rv.variant.sku,
        quantity: rv.quantity,
      })),
    };

    store.reservations.set(params.reservationKey, reservation);
    return { success: true, reservation };
  } finally {
    for (const item of params.items) {
      store.activeLocks.delete(item.variantSku);
    }
  }
}

export function releaseVariantStockAtomic(
  reservationKey: string,
  reason = 'Transaction failed or cancelled'
): StockReservationRecord | null {
  const store = getRuntimeStore();
  const reservation = store.reservations.get(reservationKey);
  if (!reservation) return null;

  if (reservation.status === 'RESERVED') {
    for (const item of reservation.items) {
      const product = store.products.find(
        (p) => p.slug === item.productSlug || p.id === item.productSlug
      );
      const variant = product?.variants.find((v) => v.sku === item.variantSku);
      if (variant) {
        variant.reservedStock = Math.max(0, variant.reservedStock - item.quantity);
      }
    }
    reservation.status = 'RELEASED';
    reservation.failureReason = reason;
  } else if (reservation.status === 'COMMITTED') {
    // If an already-committed order is cancelled, return committed stock back to physical inventory
    for (const item of reservation.items) {
      const product = store.products.find(
        (p) => p.slug === item.productSlug || p.id === item.productSlug
      );
      const variant = product?.variants.find((v) => v.sku === item.variantSku);
      if (variant) {
        variant.stock += item.quantity;
      }
    }
    reservation.status = 'RELEASED';
    reservation.failureReason = reason;
  }

  return reservation;
}

export function commitVariantStockAtomic(
  reservationKey: string
): StockReservationRecord | null {
  const store = getRuntimeStore();
  const reservation = store.reservations.get(reservationKey);
  if (!reservation) return null;

  if (reservation.status === 'RESERVED') {
    for (const item of reservation.items) {
      const product = store.products.find(
        (p) => p.slug === item.productSlug || p.id === item.productSlug
      );
      const variant = product?.variants.find((v) => v.sku === item.variantSku);
      if (variant) {
        variant.reservedStock = Math.max(0, variant.reservedStock - item.quantity);
        variant.stock = Math.max(0, variant.stock - item.quantity);
      }
    }
    reservation.status = 'COMMITTED';
  }

  return reservation;
}
