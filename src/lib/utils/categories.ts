import { Product } from '@/payload-types'

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

function collectFiltersFromMenu(
  menuId: string,
  menus: Record<string, CategoryMenuLevel>,
  visited = new Set<string>(),
): string[] {
  if (visited.has(menuId)) return []
  visited.add(menuId)

  const menu = menus[menuId]
  if (!menu) return []

  const filters: string[] = []
  if (menu.filter && menu.filter !== 'all') {
    filters.push(menu.filter)
  }

  for (const item of menu.items) {
    if (item.filter && item.filter !== 'all') {
      filters.push(item.filter)
    }
    if (item.submenu) {
      filters.push(...collectFiltersFromMenu(item.submenu, menus, visited))
    }
  }

  return filters
}

function buildSubfilterToCategoryMap(
  menus: Record<string, CategoryMenuLevel>,
): Record<string, NonNullable<Product['category']>> {
  const map: Record<string, NonNullable<Product['category']>> = {}
  const mainMenu = menus.main
  if (!mainMenu) return map

  for (const topItem of mainMenu.items) {
    if (!topItem.submenu || topItem.filter === 'all') continue

    const category = topItem.filter as NonNullable<Product['category']>
    const branchFilters = collectFiltersFromMenu(topItem.submenu, menus)

    map[category] = category
    for (const filter of branchFilters) {
      map[filter] = category
    }
  }

  return map
}

const SUBFILTER_TO_CATEGORY = buildSubfilterToCategoryMap(CATEGORY_MENUS)

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
