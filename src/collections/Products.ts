import type { CollectionConfig } from 'payload'
import { isAdminAccess } from '../lib/access'

export const Products: CollectionConfig = {
  slug: 'products',
  admin: {
    useAsTitle: 'title',
    defaultColumns: ['title', 'brand', 'category', 'price', 'averageRating'],
  },
  access: {
    read: () => true,
    create: isAdminAccess,
    update: isAdminAccess,
    delete: isAdminAccess,
  },
  fields: [
    {
      name: 'slug',
      type: 'text',
      required: true,
      unique: true,
      index: true,
      admin: {
        description: 'Acts as link to product page. Avoid spaces and special characters',
      },
    },
    {
      name: 'title',
      type: 'text',
      required: true,
      index: true,
    },
    {
      name: 'brand',
      type: 'text',
      required: true,
      index: true,
    },
    {
      name: 'price',
      type: 'number',
      required: true,
      min: 0,
      admin: {
        description: 'Price in integer cents (e.g. 8900 = $89.00).',
      },
    },
    {
      name: 'compareAtPrice',
      type: 'number',
      min: 0,
      admin: {
        description:
          'Compare-at price in integer cents (e.g. 12000 = $120.00). Used when price changes especially when reduced. This value is shown crossed out next to price.',
      },
    },
    {
      name: 'category',
      type: 'select',
      required: true,
      index: true,
      options: [
        { label: 'Jackets', value: 'jackets' },
        { label: 'Shirts', value: 'shirts' },
        { label: 'Dresses', value: 'dresses' },
        { label: 'Trousers', value: 'trousers' },
        { label: 'Shoes', value: 'shoes' },
      ],
    },
    {
      name: 'subcategory',
      type: 'text',
      required: true,
      admin: {
        description: 'Try and match store category submenus to match filtering',
      },
    },
    {
      name: 'tags',
      type: 'array',
      fields: [
        {
          name: 'tag',
          type: 'text',
          required: true,
        },
      ],
    },
    {
      name: 'size',
      type: 'select',
      defaultValue: 'normal',
      options: [
        { label: 'Normal (1-column)', value: 'normal' },
        { label: 'Large Featured (2-column)', value: 'large' },
      ],
      admin: {
        description:
          'Size of the product card in store. Use featured for products you really want to highlight',
      },
    },
    {
      name: 'description',
      type: 'textarea',
    },
    {
      name: 'material',
      type: 'text',
      required: true,
    },
    {
      name: 'fit',
      type: 'text',
      required: true,
    },
    {
      name: 'care',
      type: 'text',
      required: true,
    },
    {
      name: 'images',
      type: 'array',
      fields: [
        {
          name: 'url',
          type: 'upload',
          relationTo: 'media',
          required: true,
        },
        {
          name: 'alt',
          type: 'text',
        },
        {
          name: 'color',
          type: 'text',
          admin: {
            description: 'Human readable color',
          },
        },
      ],
    },
    {
      name: 'variants',
      type: 'array',
      fields: [
        {
          name: 'sku',
          type: 'text',
          required: true,
        },
        {
          name: 'size',
          type: 'text',
          required: true,
        },
        {
          name: 'color',
          type: 'text',
          required: true,
          admin: {
            description: 'Human readable color',
          },
        },
        {
          name: 'colorHex',
          type: 'text',
          required: true,
          admin: {
            description: 'Hex code for the color e.g #ffffff for white',
          },
        },
        {
          name: 'priceOverride',
          type: 'number',
          min: 0,
          admin: {
            description: 'Optional variant price override in integer cents (e.g. 9500 = $95.00).',
          },
        },
        {
          name: 'stock',
          type: 'number',
          required: true,
          defaultValue: 12,
          min: 0,
        },
        {
          name: 'reservedStock',
          type: 'number',
          required: true,
          defaultValue: 0,
          min: 0,
        },
        {
          name: 'lowStockThreshold',
          type: 'number',
          required: true,
          defaultValue: 5,
          min: 1,
        },
        {
          name: 'imageUrl',
          type: 'upload',
          relationTo: 'media',
          required: true,
        },
      ],
    },
    {
      name: 'averageRating',
      type: 'number',
      defaultValue: 0,
      min: 0,
      max: 5,
    },
    {
      name: 'reviewCount',
      type: 'number',
      defaultValue: 0,
      min: 0,
    },
    {
      name: 'isArchived',
      type: 'checkbox',
      defaultValue: false,
      admin: {
        description: 'Keep record of product but hide it on the storefront grid.',
      },
    },
  ],
}
