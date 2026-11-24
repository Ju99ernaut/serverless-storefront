import type { CollectionConfig } from 'payload'
import { isAdminAccess } from '../lib/access'

export const Media: CollectionConfig = {
  slug: 'media',
  access: {
    read: () => true,
    create: isAdminAccess,
    update: isAdminAccess,
    delete: isAdminAccess,
  },
  fields: [
    {
      name: 'alt',
      type: 'text',
      required: true,
    },
    {
      name: 'caption',
      type: 'text',
    },
    {
      name: 'imagekitPath',
      type: 'text',
      admin: {
        description: 'Optional ImageKit path or external R2/S3/CDN URL override.',
      },
    },
  ],
  upload: {
    disableLocalStorage: Boolean(
      process.env.STORAGE_BUCKET &&
      process.env.STORAGE_ACCESS_KEY_ID &&
      process.env.STORAGE_SECRET_ACCESS_KEY,
    ),
  },
}
