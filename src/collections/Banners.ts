import type { CollectionConfig } from 'payload'
import { isAdminAccess } from '../lib/access'

export const Banners: CollectionConfig = {
  slug: 'banners',
  admin: {
    useAsTitle: 'title',
    defaultColumns: ['title', 'badgeText', 'ctaFilter', 'active', 'sortOrder'],
  },
  access: {
    read: () => true,
    create: isAdminAccess,
    update: isAdminAccess,
    delete: isAdminAccess,
  },
  fields: [
    {
      name: 'title',
      type: 'text',
      required: true,
    },
    {
      name: 'subtitle',
      type: 'textarea',
      required: true,
    },
    {
      name: 'badgeText',
      type: 'text',
      defaultValue: 'NEW SEASON',
    },
    {
      name: 'imageUrl',
      type: 'upload',
      relationTo: 'media',
      required: true,
    },
    {
      name: 'ctaText',
      type: 'text',
      required: true,
      defaultValue: 'Explore Collection',
    },
    {
      name: 'ctaFilter',
      type: 'text',
      defaultValue: 'all',
    },
    {
      name: 'ctaProductSlug',
      type: 'text',
      admin: {
        description:
          'Slug of the product in banner(Product slug field). Acts as link to product page',
      },
    },
    {
      name: 'accentColor',
      type: 'text',
      defaultValue: '#5C5EDC',
      admin: {
        description: 'Most prominent color on the banner.',
      },
    },
    {
      name: 'active',
      type: 'checkbox',
      defaultValue: true,
    },
    {
      name: 'sortOrder',
      type: 'number',
      defaultValue: 0,
    },
  ],
}
