import { type ProductVariant, slugifyProductTitle } from '../../src/lib/utils/products'
import type { Banner, Product, Review } from '@/payload-types'

const SEED_TIMESTAMP = '2026-10-01T10:00:00.000Z'

export const HOME_BANNERS: Banner[] = [
  {
    id: 1,
    title: 'Autumn / Winter Tailored Outerwear',
    subtitle:
      'Full-grain Italian lambskin biker jackets, recycled 700-fill expedition parkas, and water-repellent flight bombers crafted for durability.',
    badgeText: 'WINTER ARCHIVE • UP TO 25% OFF',
    imageUrl: 1,
    ctaText: 'Explore Jackets',
    ctaFilter: 'jackets',
    ctaProductSlug: 'moto-full-grain-biker-jacket',
    accentColor: '#5C5EDC',
    active: true,
    sortOrder: 0,
    createdAt: SEED_TIMESTAMP,
    updatedAt: SEED_TIMESTAMP,
  },
  {
    id: 2,
    title: 'Maison Étoile Evening & Runway Edit',
    subtitle:
      'Bias-cut mulberry silk gowns, crushed velvet cocktail silhouettes, and Riviera linen sundresses designed in Paris.',
    badgeText: 'RUNWAY CAPSULE',
    imageUrl: 2,
    ctaText: 'Shop Runway Edit',
    ctaFilter: 'dresses-runway',
    ctaProductSlug: 'silk-charmeuse-evening-gown',
    accentColor: '#797BED',
    active: true,
    sortOrder: 1,
    createdAt: SEED_TIMESTAMP,
    updatedAt: SEED_TIMESTAMP,
  },
  {
    id: 3,
    title: 'Handcrafted Italian Footwear Series',
    subtitle:
      'From Milanese full-grain calfskin Chelsea boots to weatherproof Vibram trail boots and hand-burnished suede penny loafers.',
    badgeText: 'ARTISAN FOOTWEAR',
    imageUrl: 3,
    ctaText: 'Browse Artisan Shoes',
    ctaFilter: 'shoes-selection',
    ctaProductSlug: 'milan-leather-chelsea-boot',
    accentColor: '#494BC7',
    active: true,
    sortOrder: 2,
    createdAt: SEED_TIMESTAMP,
    updatedAt: SEED_TIMESTAMP,
  },
  {
    id: 4,
    title: 'Supima Oxford & Organic Linen Shirting',
    subtitle:
      'Breathable GOTS-certified organic Pima cotton, Belgian flax linen, and brushed Scottish highland flannels in modern tailored fits.',
    badgeText: 'SUSTAINABLE ESSENTIALS',
    imageUrl: 4,
    ctaText: 'View All Shirts',
    ctaFilter: 'shirts',
    ctaProductSlug: 'classic-oxford-button-down',
    accentColor: '#5C5EDC',
    active: true,
    sortOrder: 3,
    createdAt: SEED_TIMESTAMP,
    updatedAt: SEED_TIMESTAMP,
  },
]

const COLOR_PALETTES: Record<Product['category'], Array<{ name: string; hex: string }>> = {
  jackets: [
    { name: 'Obsidian Black', hex: '#1B1C20' },
    { name: 'Espresso Cognac', hex: '#5C3A28' },
    { name: 'Alpine Olive', hex: '#3D4B3A' },
  ],
  shirts: [
    { name: 'Oxford Sky', hex: '#7FA3C9' },
    { name: 'Crisp Ivory', hex: '#F3F1EB' },
    { name: 'Midnight Navy', hex: '#1E293B' },
  ],
  dresses: [
    { name: 'Noir Onyx', hex: '#18181B' },
    { name: 'Bordeaux Ruby', hex: '#6D1D34' },
    { name: 'Champagne Silk', hex: '#DFC9A6' },
  ],
  trousers: [
    { name: 'Savile Khaki', hex: '#A59272' },
    { name: 'Charcoal Slate', hex: '#374151' },
    { name: 'Raw Indigo', hex: '#23304E' },
  ],
  shoes: [
    { name: 'Burnished Tan', hex: '#8A5432' },
    { name: 'Milanese Black', hex: '#1F2024' },
    { name: 'Suede Stone', hex: '#8B857B' },
  ],
}

function buildDummyVariantsForProduct(
  id: string,
  category: Product['category'],
  imageUrl: number,
  isLowStockItem: boolean,
): ProductVariant[] {
  const sizes = category === 'shoes' ? ['40', '41', '42', '43', '44'] : ['XS', 'S', 'M', 'L', 'XL']
  const colors = COLOR_PALETTES[category]
  const variants: ProductVariant[] = []

  colors.forEach((c, cIdx) => {
    sizes.forEach((sz, sIdx) => {
      const cleanColor = c.name.split(' ').pop()?.toUpperCase() || 'STD'
      const sku = `${id.toUpperCase()}-${cleanColor}-${sz}`
      let stock = 12 - ((cIdx * 2 + sIdx) % 7)
      if (isLowStockItem) {
        if (cIdx === 0 && sIdx === 1) stock = 2
        else if (cIdx === 0 && sIdx === 2) stock = 3
        else if (cIdx === 1 && sIdx === 0) stock = 0
        else stock = 4
      } else if (cIdx === 2 && sIdx === 4) {
        stock = 3
      }

      variants.push({
        sku,
        size: sz,
        color: c.name,
        colorHex: c.hex,
        stock,
        reservedStock: 0,
        lowStockThreshold: 5,
        imageUrl,
      })
    })
  })

  return variants
}

interface RawSeedProduct {
  id: string
  title: string
  brand: string
  price: number
  compareAtPrice?: number
  category: Product['category']
  subcategory: string
  tags: string[]
  images: string[]
  size: NonNullable<Product['size']>
  material: string
  fit: string
  care: string
  lowStockDemo?: boolean
  rating: number
  reviews: number
  description: string
}

const RAW_PRODUCTS: RawSeedProduct[] = [
  {
    id: 'prod-1',
    title: 'Classic Oxford Button-Down',
    brand: 'ComposeIt Nord',
    price: 89,
    category: 'shirts',
    subcategory: 'Oxford Button-Downs',
    tags: ['shirts', 'oxford-shirts'],
    images: ['/images/shirt.png', '/images/shirt.png', '/images/shirt.png'],
    size: 'normal',
    material: '100% Supima Cotton',
    fit: 'Tailored Fit',
    care: 'Machine wash cold',
    lowStockDemo: true,
    rating: 4.9,
    reviews: 18,
    description:
      'Woven from extra-long staple Supima cotton with a soft collar roll, mother-of-pearl buttons, and single-needle tailored side seams for year-round versatility.',
  },
  {
    id: 'prod-2',
    title: 'Milan Leather Chelsea Boot',
    brand: 'Vero Passo',
    price: 210,
    category: 'shoes',
    subcategory: 'Chelsea & Leather Boots',
    tags: ['shoes', 'leather-boots', 'shoes-selection', 'handcrafted-shoes'],
    images: ['/images/shoe.png', '/images/shoe.png', '/images/shoe.png'],
    size: 'normal',
    material: 'Full-Grain Calfskin',
    fit: 'True to Size',
    care: 'Condition with leather balm',
    rating: 4.8,
    reviews: 24,
    description:
      'Hand-lasted in Milan using vegetable-tanned full-grain calfskin, Blake-stitched leather outsoles, and reinforced elastic gussets.',
  },
  {
    id: 'prod-3',
    title: 'Riviera Midi Sundress',
    brand: 'Lumière Paris',
    price: 135,
    category: 'dresses',
    subcategory: 'Summer Sundresses',
    tags: ['dresses', 'summer-dresses'],
    images: ['/images/dress.png', '/images/dress.png', '/images/dress.png'],
    size: 'normal',
    material: 'Linen & Viscose Blend',
    fit: 'Relaxed A-Line',
    care: 'Gentle cycle or dry clean',
    rating: 4.7,
    reviews: 14,
    description:
      'Effortless Côte d’Azur silhouette featuring breathable European flax linen, adjustable shoulder straps, and concealed side seam pockets.',
  },
  {
    id: 'prod-4',
    title: 'Organic Pima Crewneck Shirt',
    brand: 'Pure Loom',
    price: 65,
    category: 'shirts',
    subcategory: 'Organic Cotton',
    tags: ['shirts', 'casual-tees', 'shirts-special', 'organic-cotton'],
    images: ['/images/shirt.png', '/images/shirt.png', '/images/shirt.png'],
    size: 'large',
    material: '100% GOTS Organic Cotton',
    fit: 'Modern Regular',
    care: 'Machine wash warm',
    rating: 4.9,
    reviews: 31,
    description:
      'Heavyweight interlock knit crafted from GOTS-certified organic Peruvian Pima cotton that holds its collar structure wash after wash.',
  },
  {
    id: 'prod-5',
    title: 'Savile Stretch Tapered Chinos',
    brand: 'Kensington & Co.',
    price: 115,
    category: 'trousers',
    subcategory: 'Tailored Chinos',
    tags: ['trousers', 'chinos'],
    images: ['/images/trousers.png', '/images/trousers.png', '/images/trousers.png'],
    size: 'normal',
    material: '98% Cotton, 2% Elastane',
    fit: 'Slim Tapered',
    care: 'Machine wash cold, line dry',
    rating: 4.6,
    reviews: 19,
    description:
      'Tailored British chino engineered with organic compact twill, horn buttons, and subtle 2-way comfort stretch.',
  },
  {
    id: 'prod-6',
    title: 'Moto Full-Grain Biker Jacket',
    brand: 'Iron & Hide',
    price: 340,
    compareAtPrice: 420,
    category: 'jackets',
    subcategory: 'Leather & Biker',
    tags: ['jackets', 'leather-jackets', 'jackets-sale', 'limited-jackets'],
    images: ['/images/jacket.png', '/images/jacket.png', '/images/jacket.png'],
    size: 'large',
    material: '100% Distressed Lambskin',
    fit: 'Structured Moto Fit',
    care: 'Specialist leather clean only',
    lowStockDemo: true,
    rating: 5.0,
    reviews: 42,
    description:
      'Iconic asymmetrical biker silhouette cut from supple drum-dyed lambskin with brushed gunmetal YKK hardware and quilted satin lining.',
  },
  {
    id: 'prod-7',
    title: 'CloudStride Knit Runner',
    brand: 'Veloce Lab',
    price: 145,
    category: 'shoes',
    subcategory: 'Runner Sneakers',
    tags: ['shoes', 'runner-sneakers'],
    images: ['/images/shoe.png', '/images/shoe.png', '/images/shoe.png'],
    size: 'normal',
    material: 'Engineered Mesh & EVA Sole',
    fit: 'Athletic Snug',
    care: 'Spot clean with mild soap',
    rating: 4.7,
    reviews: 27,
    description:
      'Ultralight zonal-knit upper paired with a dual-density nitrogen-infused EVA midsole for all-day urban cushioning.',
  },
  {
    id: 'prod-8',
    title: 'Brushed Highland Flannel Shirt',
    brand: 'Caledonia Mill',
    price: 95,
    category: 'shirts',
    subcategory: 'Flannel & Overshirts',
    tags: ['shirts', 'flannel-shirts'],
    images: ['/images/shirt.png', '/images/shirt.png', '/images/shirt.png'],
    size: 'normal',
    material: '100% Brushed Twill Cotton',
    fit: 'Relaxed Layering Fit',
    care: 'Wash cold with similar colors',
    rating: 4.8,
    reviews: 15,
    description:
      'Double-brushed yarn-dyed Scottish twill that wears seamlessly as a standalone shirt or unbuttoned mid-layer overshirt.',
  },
  {
    id: 'prod-9',
    title: 'Mayfair Penny Loafer',
    brand: 'Vero Passo',
    price: 195,
    category: 'shoes',
    subcategory: 'Classic Loafers',
    tags: ['shoes', 'classic-loafers', 'shoes-selection', 'handcrafted-shoes'],
    images: ['/images/shoe.png', '/images/shoe.png', '/images/shoe.png'],
    size: 'normal',
    material: 'Hand-Burnished Suede',
    fit: 'Classic European',
    care: 'Brush with suede protector',
    lowStockDemo: true,
    rating: 4.9,
    reviews: 16,
    description:
      'Unlined water-repellent Tuscan suede penny loafer with hand-stitched apron detailing and a flexible leather-and-rubber outsole.',
  },
  {
    id: 'prod-10',
    title: 'Noir Velvet Cocktail Dress',
    brand: 'Maison Étoile',
    price: 225,
    category: 'dresses',
    subcategory: 'Cocktail Dresses',
    tags: ['dresses', 'cocktail-dresses', 'dresses-runway', 'designer-dresses'],
    images: ['/images/dress.png', '/images/dress.png', '/images/dress.png'],
    size: 'normal',
    material: 'Silk-Blend Crushed Velvet',
    fit: 'Contoured Midi',
    care: 'Dry clean only',
    lowStockDemo: true,
    rating: 4.9,
    reviews: 22,
    description:
      'Sculpted evening midi dress tailored in luminous silk-rayon velvet with internal boning and a subtle back vent.',
  },
  {
    id: 'prod-11',
    title: 'Coastal Pure Linen Shirt',
    brand: 'Amalfi Sun',
    price: 108,
    category: 'shirts',
    subcategory: 'Linen Collection',
    tags: ['shirts', 'shirts-special', 'linen-shirts'],
    images: ['/images/shirt.png', '/images/shirt.png', '/images/shirt.png'],
    size: 'normal',
    material: '100% Belgian Flax Linen',
    fit: 'Breezy Relaxed',
    care: 'Cold wash, steam while damp',
    rating: 4.8,
    reviews: 13,
    description:
      'Garment-washed Belgian flax linen with a spread camp collar and trochus shell buttons for warm-weather breathability.',
  },
  {
    id: 'prod-12',
    title: 'Selvedge Raw Indigo Denim',
    brand: 'Kuroki Works',
    price: 165,
    category: 'trousers',
    subcategory: 'Slim Fit Denim',
    tags: ['trousers', 'slim-jeans'],
    images: ['/images/trousers.png', '/images/trousers.png', '/images/trousers.png'],
    size: 'normal',
    material: '14oz Japanese Selvedge Cotton',
    fit: 'Slim Straight',
    care: 'Soak inside out in cold water',
    rating: 4.9,
    reviews: 29,
    description:
      'Shuttle-loomed 14oz rope-dyed Okayama red-line selvedge denim finished with copper rivets and a vegetable-tanned deer hide patch.',
  },
  {
    id: 'prod-13',
    title: 'MA-1 Flight Bomber Jacket',
    brand: 'Aero Archive',
    price: 179,
    category: 'jackets',
    subcategory: 'Bomber Jackets',
    tags: ['jackets', 'bomber-jackets'],
    images: ['/images/jacket.png', '/images/jacket.png', '/images/jacket.png'],
    size: 'normal',
    material: 'Water-Repellent Flight Nylon',
    fit: 'Classic Boxy Ribbed',
    care: 'Dry clean or gentle wipe',
    rating: 4.7,
    reviews: 21,
    description:
      'Authentic mid-weight flight nylon bomber with wool-blend rib-knit trims, utility sleeve zip pocket, and lightweight thermal fill.',
  },
  {
    id: 'prod-14',
    title: 'Nordic Gore-Tex Trail Boot',
    brand: 'Fjord Trek',
    price: 230,
    category: 'shoes',
    subcategory: 'Weatherproof Series',
    tags: ['shoes', 'leather-boots', 'shoes-selection', 'weatherproof-shoes'],
    images: ['/images/shoe.png', '/images/shoe.png', '/images/shoe.png'],
    size: 'normal',
    material: 'Waterproof Nubuck & Vibram',
    fit: 'All-Terrain Support',
    care: 'Rinse mud and waterproof spray',
    rating: 4.8,
    reviews: 17,
    description:
      'Seam-sealed oiled nubuck mountain boot equipped with a breathable waterproof membrane and high-traction Vibram Arctic Grip lugs.',
  },
  {
    id: 'prod-15',
    title: 'Silk Charmeuse Evening Gown',
    brand: 'Maison Étoile',
    price: 310,
    category: 'dresses',
    subcategory: 'Evening Gowns',
    tags: ['dresses', 'evening-dresses', 'dresses-runway', 'silk-dresses'],
    images: ['/images/dress.png', '/images/dress.png', '/images/dress.png'],
    size: 'large',
    material: '100% Mulberry Silk',
    fit: 'Bias-Cut Floor Length',
    care: 'Specialist silk dry clean',
    lowStockDemo: true,
    rating: 5.0,
    reviews: 34,
    description:
      'Fluid 22-momme Mulberry silk charmeuse cut on the bias to drape effortlessly with a cowl neckline and delicate rouleau straps.',
  },
  {
    id: 'prod-16',
    title: 'Utility Ripstop Cargo Pant',
    brand: 'Field & Forge',
    price: 128,
    category: 'trousers',
    subcategory: 'Cargo & Utility',
    tags: ['trousers', 'cargo-pants', 'trousers-promo', 'workwear-bundle'],
    images: ['/images/trousers.png', '/images/trousers.png', '/images/trousers.png'],
    size: 'normal',
    material: 'Heavyweight Cotton Ripstop',
    fit: 'Relaxed Articulated Knee',
    care: 'Machine wash warm',
    rating: 4.6,
    reviews: 11,
    description:
      'Military-spec crosshatch cotton ripstop with gusseted bellow pockets, articulated knees, and drawstring hem adjusters.',
  },
  {
    id: 'prod-17',
    title: 'Boardwalk Vulcanized Canvas Low',
    brand: 'Pacific Coast',
    price: 78,
    category: 'shoes',
    subcategory: 'Canvas Low-Tops',
    tags: ['shoes', 'canvas-shoes'],
    images: ['/images/shoe.png', '/images/shoe.png', '/images/shoe.png'],
    size: 'normal',
    material: '12oz Organic Duck Canvas',
    fit: 'Everyday Low Profile',
    care: 'Air dry away from direct heat',
    rating: 4.5,
    reviews: 20,
    description:
      'Kiln-fired vulcanized natural rubber foxing paired with unbleached 12oz organic duck canvas and cork-topped ortholite footbeds.',
  },
  {
    id: 'prod-18',
    title: 'Arctic Down Expedition Parka',
    brand: 'Fjord Trek',
    price: 285,
    compareAtPrice: 350,
    category: 'jackets',
    subcategory: 'Parkas & Coats',
    tags: ['jackets', 'parkas-coats', 'jackets-sale', 'winter-clearance'],
    images: ['/images/jacket.png', '/images/jacket.png', '/images/jacket.png'],
    size: 'normal',
    material: '700-Fill Recycled Down',
    fit: 'Insulated Longline',
    care: 'Tumble dry low with tennis balls',
    lowStockDemo: true,
    rating: 4.9,
    reviews: 38,
    description:
      'Sub-zero storm protection engineered with a windproof 3-layer shell, ethically sourced 700-fill down baffles, and fleece-lined handwarmer pockets.',
  },
  {
    id: 'prod-19',
    title: 'Merino Piqué Knit Polo',
    brand: 'ComposeIt Nord',
    price: 92,
    category: 'shirts',
    subcategory: 'Polo Shirts',
    tags: ['shirts', 'polo-shirts'],
    images: ['/images/shirt.png', '/images/shirt.png', '/images/shirt.png'],
    size: 'normal',
    material: 'Extra-Fine Merino Wool',
    fit: 'Slim Athletic',
    care: 'Hand wash cold, dry flat',
    rating: 4.8,
    reviews: 14,
    description:
      'Naturally odor-resistant 17.5-micron Australian merino wool knitted in a breathable micro-piqué structure with a tailored three-button placket.',
  },
  {
    id: 'prod-20',
    title: 'Bohemian Tiered Maxi Dress',
    brand: 'Lumière Paris',
    price: 158,
    category: 'dresses',
    subcategory: 'Maxi Dresses',
    tags: ['dresses', 'maxi-dresses'],
    images: ['/images/dress.png', '/images/dress.png', '/images/dress.png'],
    size: 'normal',
    material: 'Crinkle Voile Cotton',
    fit: 'Flowing Tiered Silhouette',
    care: 'Machine wash delicate',
    rating: 4.7,
    reviews: 12,
    description:
      'Sun-drenched tiered maxi dress crafted from airy cotton voile with Pintuck bodice detailing and braided tassel ties.',
  },
  {
    id: 'prod-21',
    title: 'Essential Two-Pack Chino Bundle',
    brand: 'Kensington & Co.',
    price: 185,
    compareAtPrice: 230,
    category: 'trousers',
    subcategory: 'Two-Pack Chinos',
    tags: ['trousers', 'chinos', 'trousers-promo', 'two-pack-chinos'],
    images: ['/images/trousers.png', '/images/trousers.png', '/images/trousers.png'],
    size: 'large',
    material: 'Brushed Peached Twill (2-Pack)',
    fit: 'Modern Tailored',
    care: 'Machine wash cold',
    rating: 4.9,
    reviews: 25,
    description:
      'Value two-pack pairing our best-selling Savile Khaki and Charcoal Slate tapered chinos in peached Italian stretch cotton twill.',
  },
  {
    id: 'prod-22',
    title: 'Vintage Sherpa Trucker Denim Jacket',
    brand: 'Iron & Hide',
    price: 160,
    compareAtPrice: 195,
    category: 'jackets',
    subcategory: 'Denim Jackets',
    tags: ['jackets', 'denim-jackets', 'jackets-sale', 'winter-clearance'],
    images: ['/images/jacket.png', '/images/jacket.png', '/images/jacket.png'],
    size: 'normal',
    material: '13oz Denim with Fleece Lining',
    fit: 'Classic Trucker',
    care: 'Machine wash cold inside out',
    rating: 4.8,
    reviews: 19,
    description:
      'Rugged 13oz ring-spun indigo denim trucker lined through the body and collar with high-pile thermal sherpa fleece.',
  },
  {
    id: 'prod-23',
    title: 'Pleated Flannel Dress Trousers',
    brand: 'Savile Row Co.',
    price: 175,
    category: 'trousers',
    subcategory: 'Pleated Wool',
    tags: ['trousers', 'pleated-trousers'],
    images: ['/images/trousers.png', '/images/trousers.png', '/images/trousers.png'],
    size: 'normal',
    material: '100% Virgin Worsted Wool',
    fit: 'High-Rise Single Pleat',
    care: 'Dry clean only',
    rating: 4.9,
    reviews: 15,
    description:
      'Sartorial high-waisted trousers cut from Vitale Barberis Canonico wool flannel with side-tab waist adjusters and cupro knee lining.',
  },
]

export const PRODUCTS: Product[] = RAW_PRODUCTS.map((item, idx) => {
  const slug = slugifyProductTitle(item.title)
  return {
    id: idx + 1,
    slug,
    title: item.title,
    brand: item.brand,
    price: Math.round(item.price * 100),
    compareAtPrice: item.compareAtPrice ? Math.round(item.compareAtPrice * 100) : undefined,
    category: item.category,
    subcategory: item.subcategory,
    tags: item.tags.map((tag) => ({ tag })),
    images: item.images.map((_, imgIdx) => ({
      url: 1,
      alt: `${item.title} view ${imgIdx + 1}`,
    })),
    size: item.size,
    description: item.description,
    material: item.material,
    fit: item.fit,
    care: item.care,
    variants: buildDummyVariantsForProduct(item.id, item.category, 1, Boolean(item.lowStockDemo)),
    averageRating: item.rating,
    reviewCount: item.reviews,
    createdAt: SEED_TIMESTAMP,
    updatedAt: SEED_TIMESTAMP,
  }
})

export const INITIAL_REVIEWS: Review[] = [
  {
    id: 1,
    productSlug: 'classic-oxford-button-down',
    authorName: 'Marcus Vance',
    rating: 5,
    title: 'Best collar roll I have found under $150',
    comment:
      'The Supima cotton feels substantial yet breathable. Wore the Oxford Sky in Medium to the office all week and it barely wrinkled.',
    variantSize: 'M',
    variantColor: 'Oxford Sky',
    verifiedPurchase: true,
    createdAt: '2026-10-28T14:22:00.000Z',
    updatedAt: '2026-10-28T14:22:00.000Z',
  },
  {
    id: 2,
    productSlug: 'classic-oxford-button-down',
    authorName: 'Elena Rostova',
    rating: 5,
    title: 'Impeccable stitching and fit',
    comment:
      'Bought this for my partner in Crisp Ivory. True tailored fit without pulling across the chest.',
    variantSize: 'L',
    variantColor: 'Crisp Ivory',
    verifiedPurchase: true,
    createdAt: '2026-11-04T09:15:00.000Z',
    updatedAt: '2026-11-04T09:15:00.000Z',
  },
  {
    id: 3,
    productSlug: 'moto-full-grain-biker-jacket',
    authorName: 'Julian Sterling',
    rating: 5,
    title: 'Heirloom-grade lambskin leather',
    comment:
      'The weight and grain on the Obsidian Black jacket rival designer pieces at three times the price. Zippers glide like butter.',
    variantSize: 'L',
    variantColor: 'Obsidian Black',
    verifiedPurchase: true,
    createdAt: '2026-11-08T18:40:00.000Z',
    updatedAt: '2026-11-08T18:40:00.000Z',
  },
  {
    id: 4,
    productSlug: 'silk-charmeuse-evening-gown',
    authorName: 'Camille Laurent',
    rating: 5,
    title: 'Drapes like liquid gold',
    comment:
      'Wore the Champagne Silk to a gala and received compliments all evening. Bias cut is super flattering.',
    variantSize: 'S',
    variantColor: 'Champagne Silk',
    verifiedPurchase: true,
    createdAt: '2026-11-10T20:05:00.000Z',
    updatedAt: '2026-11-10T20:05:00.000Z',
  },
  {
    id: 5,
    productSlug: 'milan-leather-chelsea-boot',
    authorName: 'Devon Brooks',
    rating: 4,
    title: 'Zero break-in period required',
    comment: 'Calfskin is supple right out of the box. Runs true to European sizing.',
    variantSize: '42',
    variantColor: 'Milanese Black',
    verifiedPurchase: true,
    createdAt: '2026-11-12T11:30:00.000Z',
    updatedAt: '2026-11-12T11:30:00.000Z',
  },
]
