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

export interface BottomBarFilter {
  id: string
  label: string
  icon: 'all' | 'jacket' | 'shirt' | 'dress' | 'trousers' | 'shoe'
}

export interface CategoryMenuItem {
  label: string
  filter: string
  submenu?: string
}

export interface CategoryMenuLevel {
  id: string
  name: string
  parentId: string | null
  filter: string
  items: CategoryMenuItem[]
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
    description: 'Instant express checkout with tracked courier delivery to your doorstep.',
    requiresCardNow: true,
    requiresShippingAddress: true,
    fulfillmentMethod: 'DELIVERY',
    badge: 'Fastest Shipping',
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
    description: 'Reserve stock for 48 hours, try it on in-store, and pay when you collect.',
    requiresCardNow: false,
    requiresShippingAddress: false,
    fulfillmentMethod: 'COLLECTION',
    badge: 'Try Before Paying',
  },
]

export const BOTTOM_BAR_FILTERS: BottomBarFilter[] = [
  { id: 'all', label: 'All', icon: 'all' },
  { id: 'jackets', label: 'Jackets', icon: 'jacket' },
  { id: 'shirts', label: 'Shirts', icon: 'shirt' },
  { id: 'dresses', label: 'Dresses', icon: 'dress' },
  { id: 'trousers', label: 'Trousers', icon: 'trousers' },
  { id: 'shoes', label: 'Shoes', icon: 'shoe' },
]

export const CATEGORY_MENUS: Record<string, CategoryMenuLevel> = {
  main: {
    id: 'main',
    name: 'all',
    parentId: null,
    filter: 'all',
    items: [
      { label: 'All Products', filter: 'all' },
      { label: 'Jackets', submenu: 'submenu-jackets', filter: 'jackets' },
      { label: 'Shirts', submenu: 'submenu-shirts', filter: 'shirts' },
      { label: 'Dresses', submenu: 'submenu-dresses', filter: 'dresses' },
      { label: 'Trousers', submenu: 'submenu-trousers', filter: 'trousers' },
      { label: 'Shoes', submenu: 'submenu-shoes', filter: 'shoes' },
    ],
  },
  'submenu-jackets': {
    id: 'submenu-jackets',
    name: 'Jackets',
    parentId: 'main',
    filter: 'jackets',
    items: [
      { label: 'All Jackets', filter: 'jackets' },
      { label: 'Leather & Biker', filter: 'leather-jackets' },
      { label: 'Bomber Jackets', filter: 'bomber-jackets' },
      { label: 'Parkas & Coats', filter: 'parkas-coats' },
      { label: 'Denim Jackets', filter: 'denim-jackets' },
      {
        label: 'Sale %',
        submenu: 'submenu-jackets-sale',
        filter: 'jackets-sale',
      },
    ],
  },
  'submenu-jackets-sale': {
    id: 'submenu-jackets-sale',
    name: 'Sale %',
    parentId: 'submenu-jackets',
    filter: 'jackets-sale',
    items: [
      { label: 'Winter Clearance', filter: 'winter-clearance' },
      { label: 'Limited Edition', filter: 'limited-jackets' },
    ],
  },
  'submenu-shirts': {
    id: 'submenu-shirts',
    name: 'Shirts',
    parentId: 'main',
    filter: 'shirts',
    items: [
      { label: 'All Shirts', filter: 'shirts' },
      { label: 'Oxford Button-Downs', filter: 'oxford-shirts' },
      { label: 'Casual Tees', filter: 'casual-tees' },
      { label: 'Flannel & Overshirts', filter: 'flannel-shirts' },
      { label: 'Polo Shirts', filter: 'polo-shirts' },
      {
        label: 'Special Selection',
        submenu: 'submenu-shirts-special',
        filter: 'shirts-special',
      },
    ],
  },
  'submenu-shirts-special': {
    id: 'submenu-shirts-special',
    name: 'Special Selection',
    parentId: 'submenu-shirts',
    filter: 'shirts-special',
    items: [
      { label: 'Organic Cotton', filter: 'organic-cotton' },
      { label: 'Linen Collection', filter: 'linen-shirts' },
    ],
  },
  'submenu-dresses': {
    id: 'submenu-dresses',
    name: 'Dresses',
    parentId: 'main',
    filter: 'dresses',
    items: [
      { label: 'All Dresses', filter: 'dresses' },
      { label: 'Evening Gowns', filter: 'evening-dresses' },
      { label: 'Summer Sundresses', filter: 'summer-dresses' },
      { label: 'Cocktail Dresses', filter: 'cocktail-dresses' },
      { label: 'Maxi Dresses', filter: 'maxi-dresses' },
      {
        label: 'Runway Edit',
        submenu: 'submenu-dresses-runway',
        filter: 'dresses-runway',
      },
    ],
  },
  'submenu-dresses-runway': {
    id: 'submenu-dresses-runway',
    name: 'Runway Edit',
    parentId: 'submenu-dresses',
    filter: 'dresses-runway',
    items: [
      { label: 'Silk & Satin', filter: 'silk-dresses' },
      { label: 'Designer Capsule', filter: 'designer-dresses' },
    ],
  },
  'submenu-trousers': {
    id: 'submenu-trousers',
    name: 'Trousers',
    parentId: 'main',
    filter: 'trousers',
    items: [
      { label: 'All Trousers', filter: 'trousers' },
      { label: 'Tailored Chinos', filter: 'chinos' },
      { label: 'Slim Fit Denim', filter: 'slim-jeans' },
      { label: 'Pleated Wool', filter: 'pleated-trousers' },
      { label: 'Cargo & Utility', filter: 'cargo-pants' },
      {
        label: 'Promo Packs',
        submenu: 'submenu-trousers-promo',
        filter: 'trousers-promo',
      },
    ],
  },
  'submenu-trousers-promo': {
    id: 'submenu-trousers-promo',
    name: 'Promo Packs',
    parentId: 'submenu-trousers',
    filter: 'trousers-promo',
    items: [
      { label: 'Two-Pack Chinos', filter: 'two-pack-chinos' },
      { label: 'Workwear Bundle', filter: 'workwear-bundle' },
    ],
  },
  'submenu-shoes': {
    id: 'submenu-shoes',
    name: 'Shoes',
    parentId: 'main',
    filter: 'shoes',
    items: [
      { label: 'All Shoes', filter: 'shoes' },
      { label: 'Chelsea & Leather Boots', filter: 'leather-boots' },
      { label: 'Runner Sneakers', filter: 'runner-sneakers' },
      { label: 'Classic Loafers', filter: 'classic-loafers' },
      { label: 'Canvas Low-Tops', filter: 'canvas-shoes' },
      {
        label: 'Artisan Selection',
        submenu: 'submenu-shoes-selection',
        filter: 'shoes-selection',
      },
    ],
  },
  'submenu-shoes-selection': {
    id: 'submenu-shoes-selection',
    name: 'Artisan Selection',
    parentId: 'submenu-shoes',
    filter: 'shoes-selection',
    items: [
      { label: 'Handcrafted Italian', filter: 'handcrafted-shoes' },
      { label: 'Weatherproof Series', filter: 'weatherproof-shoes' },
    ],
  },
}

export function slugifyProductTitle(title: string): string {
  return title
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, '-')
    .replace(/(^-|-$)/g, '')
}

export const TAX_RATE = 0.08
export const DELIVERY_FEE_CENTS = 1200

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
  const shippingCents = fulfillmentMethod === 'DELIVERY' ? DELIVERY_FEE_CENTS : 0
  const grandTotalCents = subTotalCents + taxCents + shippingCents
  return {
    subTotalCents,
    taxCents,
    shippingCents,
    grandTotalCents,
  }
}

export function getProductImages(product: Product): string[] {
  const imgs = product.images?.map((i) => i.url).filter(Boolean) ?? []
  return imgs.length > 0 ? imgs : ['/images/shirt.png']
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

const SUBFILTER_TO_CATEGORY: Record<string, Product['category']> = {
  jackets: 'jackets',
  'leather-jackets': 'jackets',
  'bomber-jackets': 'jackets',
  'parkas-coats': 'jackets',
  'denim-jackets': 'jackets',
  'jackets-sale': 'jackets',
  'winter-clearance': 'jackets',
  'limited-jackets': 'jackets',
  shirts: 'shirts',
  'oxford-shirts': 'shirts',
  'casual-tees': 'shirts',
  'flannel-shirts': 'shirts',
  'polo-shirts': 'shirts',
  'shirts-special': 'shirts',
  'organic-cotton': 'shirts',
  'linen-shirts': 'shirts',
  dresses: 'dresses',
  'evening-dresses': 'dresses',
  'summer-dresses': 'dresses',
  'cocktail-dresses': 'dresses',
  'maxi-dresses': 'dresses',
  'dresses-runway': 'dresses',
  'silk-dresses': 'dresses',
  'designer-dresses': 'dresses',
  trousers: 'trousers',
  chinos: 'trousers',
  'slim-jeans': 'trousers',
  'pleated-trousers': 'trousers',
  'cargo-pants': 'trousers',
  'trousers-promo': 'trousers',
  'two-pack-chinos': 'trousers',
  'workwear-bundle': 'trousers',
  shoes: 'shoes',
  'leather-boots': 'shoes',
  'runner-sneakers': 'shoes',
  'classic-loafers': 'shoes',
  'canvas-shoes': 'shoes',
  'shoes-selection': 'shoes',
  'handcrafted-shoes': 'shoes',
  'weatherproof-shoes': 'shoes',
}

export function getMainCategoryForFilter(filter: string, catalogProducts?: Product[]): string {
  if (!filter || filter === 'all') return 'all'
  if (SUBFILTER_TO_CATEGORY[filter]) {
    return SUBFILTER_TO_CATEGORY[filter]
  }
  const match = catalogProducts?.find((p) => p.tags?.some((t) => t.tag === filter))
  return match ? match.category : 'all'
}

export function getFilterDisplayName(filter: string): string {
  if (!filter || filter === 'all') return 'All Products'
  for (const menu of Object.values(CATEGORY_MENUS)) {
    for (const item of menu.items) {
      if (item.filter === filter) {
        return item.label
      }
    }
  }
  return filter
}
