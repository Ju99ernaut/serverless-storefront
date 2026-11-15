import type { CollectionConfig } from 'payload'

export const Products: CollectionConfig = {
  slug: 'products',
  admin: {
    useAsTitle: 'title',
    defaultColumns: ['title', 'brand', 'category', 'price', 'averageRating'],
  },
  access: {
    read: () => true,
    create: () => true,
    update: () => true,
  },
  fields: [
    {
      name: 'slug',
      type: 'text',
      required: true,
      unique: true,
      index: true,
    },
    {
      name: 'legacyId',
      type: 'text',
      index: true,
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
    },
    {
      name: 'compareAtPrice',
      type: 'number',
      min: 0,
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
          type: 'text',
          required: true,
        },
        {
          name: 'alt',
          type: 'text',
        },
        {
          name: 'color',
          type: 'text',
        },
        {
          name: 'media',
          type: 'upload',
          relationTo: 'media',
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
        },
        {
          name: 'colorHex',
          type: 'text',
          required: true,
        },
        {
          name: 'priceOverride',
          type: 'number',
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
          type: 'text',
        },
      ],
    },
    {
      name: 'averageRating',
      type: 'number',
      defaultValue: 4.8,
      min: 0,
      max: 5,
    },
    {
      name: 'reviewCount',
      type: 'number',
      defaultValue: 0,
      min: 0,
    },
  ],
}
