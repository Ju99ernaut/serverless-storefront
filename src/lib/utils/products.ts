import type { Cart, Order, Product, Wishlist } from '../../payload-types'

export type PaymentOptionType = Order['paymentOption']
export type ProductVariant = NonNullable<Product['variants']>[number]
export type CartLineItem = NonNullable<Cart['items']>[number]
export type OrderLineItem = NonNullable<Order['items']>[number]
export type WishlistItem = NonNullable<Wishlist['items']>[number]

export interface NeonUser {
  id: string
  email: string
  name: string
  role?: string | null
  image?: string | null
  emailVerified?: boolean
  createdAt?: Date | string
  updatedAt?: Date | string
}

export const PAYMENT_OPTIONS: Array<{
  id: PaymentOptionType
  label: string
  shortLabel: string
  description: string
  requiresCardNow: boolean
  requiresShippingAddress: boolean
  fulfillmentMethod: Order['fulfillmentMethod']
  badge: string
}> = [
  {
    id: 'pay_and_delivery',
    label: 'Pay Now & Home Delivery',
    shortLabel: 'Pay & Delivery',
    description: 'Instant express checkout with delivery to your doorstep.',
    requiresCardNow: true,
    requiresShippingAddress: true,
    fulfillmentMethod: 'DELIVERY',
    badge: 'Fast Delivery',
  },
  {
    id: 'pay_then_collect',
    label: 'Pay Now & Store Collection',
    shortLabel: 'Pay then Collect',
    description: 'Pay online now to lock in your items and pick up at our shop.',
    requiresCardNow: true,
    requiresShippingAddress: false,
    fulfillmentMethod: 'COLLECTION',
    badge: 'Ready in 2h',
  },
  {
    id: 'pay_on_delivery',
    label: 'Pay on Delivery (COD)',
    shortLabel: 'Pay on Delivery',
    description: 'Reserve your clothing now and pay when the courier arrives.',
    requiresCardNow: false,
    requiresShippingAddress: true,
    fulfillmentMethod: 'DELIVERY',
    badge: 'Pay at Door',
  },
  {
    id: 'pay_on_collection',
    label: 'Pay on Collection',
    shortLabel: 'Pay on Collection',
    description: 'Reserve stock, try it on in-store, and pay when you collect.',
    requiresCardNow: false,
    requiresShippingAddress: false,
    fulfillmentMethod: 'COLLECTION',
    badge: 'Try Before Paying',
  },
]

export const TAX_RATE = process.env.NEXT_PUBLIC_TAX_RATE
  ? Number(process.env.NEXT_PUBLIC_TAX_RATE)
  : 0

export function centsToDollars(cents: number | null | undefined): number {
  const safeCents = Math.round(Number(cents) || 0)
  return Number((safeCents / 100).toFixed(2))
}

export function formatCentsAsDollars(cents: number | null | undefined): string {
  return `$${centsToDollars(cents).toFixed(2)}`
}

export function calculateOrderTotalsCents(
  items: Array<{ unitPriceCents: number; quantity: number }>,
  fulfillmentMethod: Order['fulfillmentMethod'],
  deliveryFeeCents?: number,
): {
  subTotalCents: number
  taxCents: number
  shippingCents: number
  grandTotalCents: number
} {
  const subTotalCents = items.reduce((sum, item) => {
    const unitCents = Math.round(Number(item.unitPriceCents) || 0)
    const qty = Math.max(1, Math.round(Number(item.quantity) || 1))
    return sum + unitCents * qty
  }, 0)
  const taxCents = Math.round(subTotalCents * TAX_RATE)
  const shippingCents = fulfillmentMethod === 'DELIVERY' && deliveryFeeCents ? deliveryFeeCents : 0
  const grandTotalCents = subTotalCents + taxCents + shippingCents
  return {
    subTotalCents,
    taxCents,
    shippingCents,
    grandTotalCents,
  }
}

export function getProductImages(product: Product): string[] {
  const imgs =
    product.images
      ?.map((i) => (typeof i.url === 'number' ? undefined : i.url.url))
      .filter(Boolean) ?? []
  return imgs.length > 0 ? (imgs as string[]) : ['/images/shirt.png']
}

export function getProductTotalAvailableStock(product: Product): number {
  if (!product.variants || product.variants.length === 0) return 15
  return product.variants.reduce((sum, v) => sum + Math.max(0, v.stock - (v.reservedStock || 0)), 0)
}

export function getProductLowestAvailableVariantStock(product: Product): {
  minAvailable: number
  hasLowStockVariant: boolean
  isCompletelyOutOfStock: boolean
  lowStockVariantLabel: string | null
} {
  if (!product.variants || product.variants.length === 0) {
    return {
      minAvailable: 10,
      hasLowStockVariant: false,
      isCompletelyOutOfStock: false,
      lowStockVariantLabel: null,
    }
  }

  let totalAvailable = 0
  let minPositive = Infinity
  let lowVariant: ProductVariant | null = null

  for (const v of product.variants) {
    const avail = Math.max(0, v.stock - (v.reservedStock || 0))
    totalAvailable += avail
    if (avail > 0 && avail <= (v.lowStockThreshold || 5) && avail < minPositive) {
      minPositive = avail
      lowVariant = v
    }
  }

  return {
    minAvailable: minPositive === Infinity ? totalAvailable : minPositive,
    hasLowStockVariant: Boolean(lowVariant),
    isCompletelyOutOfStock: totalAvailable <= 0,
    lowStockVariantLabel: lowVariant
      ? `Only ${Math.max(0, lowVariant.stock - (lowVariant.reservedStock || 0))} left in ${lowVariant.color} (${lowVariant.size})`
      : null,
  }
}

export function slugifyProductTitle(title: string): string {
  return title
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, '-')
    .replace(/(^-|-$)/g, '')
}
