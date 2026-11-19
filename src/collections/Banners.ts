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
      type: 'text',
      required: true,
    },
    {
      name: 'media',
      type: 'upload',
      relationTo: 'media',
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
    },
    {
      name: 'accentColor',
      type: 'text',
      defaultValue: '#5C5EDC',
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
