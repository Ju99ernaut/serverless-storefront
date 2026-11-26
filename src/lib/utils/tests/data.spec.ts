import { describe, it, expect } from 'vitest'
import {
  TAX_RATE,
  PAYMENT_OPTIONS,
  BOTTOM_BAR_FILTERS,
  calculateOrderTotalsCents,
  centsToDollars,
  formatCentsAsDollars,
  getProductLowestAvailableVariantStock,
  getProductTotalAvailableStock,
  getProductImages,
  getMainCategoryForFilter,
  getFilterDisplayName,
  slugifyProductTitle,
} from '../data'
import type { Product } from '@/payload-types'

describe('src/lib/utils/data unit tests', () => {
  describe('centsToDollars', () => {
    it('converts valid positive integers to dollars', () => {
      expect(centsToDollars(100)).toBe(1.0)
      expect(centsToDollars(2550)).toBe(25.5)
      expect(centsToDollars(99)).toBe(0.99)
      expect(centsToDollars(0)).toBe(0)
    })

    it('handles negative or invalid values gracefully', () => {
      expect(centsToDollars(-500)).toBe(-5)
      expect(centsToDollars(NaN)).toBe(0)
      expect(centsToDollars(undefined)).toBe(0)
      expect(centsToDollars(null)).toBe(0)
    })
  })

  describe('formatCentsAsDollars', () => {
    it('formats cents as standard USD currency string', () => {
      expect(formatCentsAsDollars(0)).toBe('$0.00')
      expect(formatCentsAsDollars(100)).toBe('$1.00')
      expect(formatCentsAsDollars(2499)).toBe('$24.99')
      expect(formatCentsAsDollars(100000)).toBe('$1000.00')
    })

    it('formats invalid/undefined cents as $0.00', () => {
      expect(formatCentsAsDollars(NaN)).toBe('$0.00')
      expect(formatCentsAsDollars(undefined)).toBe('$0.00')
      expect(formatCentsAsDollars(null)).toBe('$0.00')
    })
  })

  describe('calculateOrderTotalsCents', () => {
    it('calculates totals with DELIVERY fee and TAX_RATE', () => {
      const items = [
        { unitPriceCents: 5000, quantity: 2 }, // 10000 cents ($100)
        { unitPriceCents: 2500, quantity: 1 }, // 2500 cents ($25)
      ]
      const deliveryFeeCents = 600
      const totals = calculateOrderTotalsCents(items, 'DELIVERY', deliveryFeeCents)
      expect(totals.subTotalCents).toBe(12500)
      expect(totals.shippingCents).toBe(deliveryFeeCents)
      expect(totals.taxCents).toBe(Math.round(12500 * TAX_RATE))
      expect(totals.grandTotalCents).toBe(12500 + totals.taxCents + deliveryFeeCents)
    })

    it('calculates totals with COLLECTION fulfillment (shipping is 0)', () => {
      const items = [{ unitPriceCents: 10000, quantity: 1 }]
      const totals = calculateOrderTotalsCents(items, 'COLLECTION')
      expect(totals.subTotalCents).toBe(10000)
      expect(totals.shippingCents).toBe(0)
      expect(totals.taxCents).toBe(Math.round(10000 * TAX_RATE))
      expect(totals.grandTotalCents).toBe(10000 + totals.taxCents)
    })

    it('handles empty items array gracefully', () => {
      const totals = calculateOrderTotalsCents([], 'COLLECTION')
      expect(totals.subTotalCents).toBe(0)
      expect(totals.taxCents).toBe(0)
      expect(totals.shippingCents).toBe(0)
      expect(totals.grandTotalCents).toBe(0)
    })
  })

  describe('getProductLowestAvailableVariantStock', () => {
    it('returns lowest available stock when low stock variant exists', () => {
      const product = {
        title: 'Shirt',
        variants: [
          {
            sku: 'S-1',
            stock: 10,
            reservedStock: 0,
            lowStockThreshold: 5,
            color: 'Black',
            size: 'M',
          },
          {
            sku: 'S-2',
            stock: 4,
            reservedStock: 1,
            lowStockThreshold: 5,
            color: 'White',
            size: 'L',
          }, // avail = 3
          {
            sku: 'S-3',
            stock: 8,
            reservedStock: 0,
            lowStockThreshold: 5,
            color: 'Blue',
            size: 'S',
          },
        ],
      } as unknown as Product

      const stockInfo = getProductLowestAvailableVariantStock(product)
      expect(stockInfo.hasLowStockVariant).toBe(true)
      expect(stockInfo.minAvailable).toBe(3)
      expect(stockInfo.isCompletelyOutOfStock).toBe(false)
      expect(stockInfo.lowStockVariantLabel).toContain('Only 3 left in White (L)')
    })

    it('detects completely out of stock when total available is 0', () => {
      const product = {
        title: 'Shirt',
        variants: [
          { sku: 'S-1', stock: 5, reservedStock: 5 },
          { sku: 'S-2', stock: 0, reservedStock: 0 },
        ],
      } as unknown as Product

      const stockInfo = getProductLowestAvailableVariantStock(product)
      expect(stockInfo.isCompletelyOutOfStock).toBe(true)
      expect(stockInfo.hasLowStockVariant).toBe(false)
    })

    it('returns default fallback when product has no variants', () => {
      const product = {
        title: 'Shirt',
        variants: [],
      } as unknown as Product

      const stockInfo = getProductLowestAvailableVariantStock(product)
      expect(stockInfo.minAvailable).toBe(10)
      expect(stockInfo.hasLowStockVariant).toBe(false)
      expect(stockInfo.isCompletelyOutOfStock).toBe(false)
    })
  })

  describe('getProductTotalAvailableStock', () => {
    it('sums available stock (stock - reservedStock) across all variants', () => {
      const product = {
        variants: [
          { sku: 'V1', stock: 10, reservedStock: 2 }, // 8
          { sku: 'V2', stock: 5, reservedStock: 1 }, // 4
          { sku: 'V3', stock: 2, reservedStock: 5 }, // 0 (clamped to 0)
        ],
      } as unknown as Product

      expect(getProductTotalAvailableStock(product)).toBe(12)
    })

    it('returns fallback of 15 if no variants present', () => {
      expect(getProductTotalAvailableStock({} as unknown as Product)).toBe(15)
    })
  })

  describe('getProductImages', () => {
    it('returns image urls if available', () => {
      const product = {
        images: [{ url: { url: '/img1.jpg' } }, { url: { url: '/img2.jpg' } }],
      } as unknown as Product
      expect(getProductImages(product)).toEqual(['/img1.jpg', '/img2.jpg'])
    })

    it('returns fallback shirt image if no images', () => {
      const product = { images: [] } as unknown as Product
      expect(getProductImages(product)).toEqual(['/images/shirt.png'])
    })
  })

  describe('slugify and filter helpers', () => {
    it('slugifies strings cleanly', () => {
      expect(slugifyProductTitle('Hello World 123!')).toBe('hello-world-123')
      expect(slugifyProductTitle('  --Organic Cotton T-Shirt--  ')).toBe('organic-cotton-t-shirt')
    })

    it('resolves main category for subfilters', () => {
      expect(getMainCategoryForFilter('all')).toBe('all')
      expect(getMainCategoryForFilter('leather-jackets')).toBe('jackets')
      expect(getMainCategoryForFilter('oxford-shirts')).toBe('shirts')
      expect(getMainCategoryForFilter('summer-dresses')).toBe('dresses')
      expect(getMainCategoryForFilter('slim-jeans')).toBe('trousers')
      expect(getMainCategoryForFilter('runner-sneakers')).toBe('shoes')
    })

    it('resolves display names for filters', () => {
      expect(getFilterDisplayName('all')).toBe('All Products')
      expect(getFilterDisplayName('jackets')).toBe('Jackets')
      expect(getFilterDisplayName('leather-jackets')).toBe('Leather & Biker')
      expect(getFilterDisplayName('unknown-filter')).toBe('unknown-filter')
    })

    it('exposes payment options and bottom bar filters', () => {
      expect(PAYMENT_OPTIONS.length).toBe(4)
      expect(BOTTOM_BAR_FILTERS.length).toBe(6)
    })
  })
})
