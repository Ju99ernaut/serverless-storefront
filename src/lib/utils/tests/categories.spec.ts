import { describe, it, expect } from 'vitest'
import { getMainCategoryForFilter, getFilterDisplayName } from '../categories'

describe('src/lib/utils/categories unit tests', () => {
  describe('filter helpers', () => {
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
  })
})
