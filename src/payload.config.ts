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
import { Categories } from './collections/Categories'
import { Banners } from './collections/Banners'
import { Products } from './collections/Products'
import { Reviews } from './collections/Reviews'
import { Orders } from './collections/Orders'
import { StockReservations } from './collections/StockReservations'

const filename = fileURLToPath(import.meta.url)
const dirname = path.dirname(filename)

const r2Endpoint = process.env.R2_ENDPOINT
const r2PublicUrl = process.env.R2_PUBLIC_URL

const isR2Enabled = Boolean(
  process.env.R2_BUCKET &&
  process.env.R2_ACCESS_KEY_ID &&
  process.env.R2_SECRET_ACCESS_KEY &&
  r2Endpoint,
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
    Categories,
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
      enabled: isR2Enabled,
      collections: {
        media: {
          prefix: 'media',
          generateFileURL: r2PublicUrl
            ? ({ filename, prefix }) =>
                `${r2PublicUrl.replace(/\/$/, '')}/${prefix ? `${prefix}/` : ''}${filename}`
            : undefined,
        },
      },
      bucket: process.env.R2_BUCKET || 'the-store-media',
      config: {
        region: 'auto',
        endpoint: r2Endpoint,
        forcePathStyle: true,
        credentials: {
          accessKeyId: process.env.R2_ACCESS_KEY_ID || '',
          secretAccessKey: process.env.R2_SECRET_ACCESS_KEY || '',
        },
      },
    }),
  ],
})
