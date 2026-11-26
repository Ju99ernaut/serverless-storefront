import { vercelPostgresAdapter } from '@payloadcms/db-vercel-postgres'
import { lexicalEditor } from '@payloadcms/richtext-lexical'
import { s3Storage } from '@payloadcms/storage-s3'
import path from 'path'
import { buildConfig } from 'payload'
import { fileURLToPath } from 'url'
import sharp from 'sharp'

import { Users } from './collections/Users'
import { BillingDetails } from './collections/BillingDetails'
import { Carts } from './collections/Carts'
import { Wishlists } from './collections/Wishlists'
import { Media } from './collections/Media'
import { Banners } from './collections/Banners'
import { Products } from './collections/Products'
import { Reviews } from './collections/Reviews'
import { Orders } from './collections/Orders'
import { StockReservations } from './collections/StockReservations'

const filename = fileURLToPath(import.meta.url)
const dirname = path.dirname(filename)

const storageEndpoint = process.env.STORAGE_ENDPOINT
const storagePublicUrl = process.env.STORAGE_PUBLIC_URL

const isStorageEnabled = Boolean(
  process.env.STORAGE_BUCKET &&
  process.env.STORAGE_ACCESS_KEY_ID &&
  process.env.STORAGE_SECRET_ACCESS_KEY &&
  storageEndpoint,
)

export default buildConfig({
  admin: {
    user: Users.slug,
    importMap: {
      baseDir: path.resolve(dirname),
    },
  },
  collections: [
    Users,
    BillingDetails,
    Carts,
    Wishlists,
    Media,
    Banners,
    Products,
    Reviews,
    Orders,
    StockReservations,
  ],
  editor: lexicalEditor(),
  secret: process.env.DB_SECRET || 'default-storefront-payload-secret-key',
  typescript: {
    outputFile: path.resolve(dirname, 'payload-types.ts'),
  },
  db: vercelPostgresAdapter({
    pool: {
      connectionString: process.env.DATABASE_URL || '',
    },
  }),
  sharp,
  plugins: [
    s3Storage({
      enabled: isStorageEnabled,
      collections: {
        media: {
          prefix: 'media',
          generateFileURL: storagePublicUrl
            ? ({ filename, prefix }) =>
                `${storagePublicUrl.replace(/\/$/, '')}/${prefix ? `${prefix}/` : ''}${filename}`
            : undefined,
        },
      },
      bucket: process.env.STORAGE_BUCKET || 'the-store-media',
      config: {
        region: process.env.STORAGE_REGION || 'auto',
        endpoint: storageEndpoint,
        forcePathStyle: true,
        credentials: {
          accessKeyId: process.env.STORAGE_ACCESS_KEY_ID || '',
          secretAccessKey: process.env.STORAGE_SECRET_ACCESS_KEY || '',
        },
      },
    }),
  ],
})
