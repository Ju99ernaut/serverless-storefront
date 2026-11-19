import type { CollectionConfig } from 'payload'

export const Carts: CollectionConfig = {
  slug: 'carts',
  admin: {
    useAsTitle: 'neonUserId',
    defaultColumns: ['neonUserId', 'updatedAt'],
  },
  access: {
    read: () => true,
    create: () => true,
    update: () => true,
    delete: () => true,
  },
  fields: [
    {
      name: 'neonUserId',
      type: 'text',
      required: true,
      unique: true,
      index: true,
    },
    {
      name: 'items',
      type: 'array',
      fields: [
        {
          name: 'product',
          type: 'relationship',
          relationTo: 'products',
        },
        {
          name: 'productSlug',
          type: 'text',
          required: true,
        },
        {
          name: 'cartItemId',
          type: 'text',
          required: true,
        },
        {
          name: 'variantSku',
          type: 'text',
          required: true,
        },
        {
          name: 'title',
          type: 'text',
          required: true,
        },
        {
          name: 'brand',
          type: 'text',
          required: true,
        },
        {
          name: 'category',
          type: 'text',
          required: true,
        },
        {
          name: 'subcategory',
          type: 'text',
          required: true,
        },
        {
          name: 'selectedSize',
          type: 'text',
          required: true,
        },
        {
          name: 'selectedColor',
          type: 'text',
          required: true,
        },
        {
          name: 'selectedColorHex',
          type: 'text',
          required: true,
        },
        {
          name: 'unitPrice',
          type: 'number',
          required: true,
          min: 0,
        },
        {
          name: 'price',
          type: 'number',
          required: true,
          min: 0,
        },
        {
          name: 'quantity',
          type: 'number',
          required: true,
          min: 1,
        },
        {
          name: 'maxAvailableStock',
          type: 'number',
          required: true,
          defaultValue: 99,
        },
        {
          name: 'imageUrl',
          type: 'text',
        },
      ],
    },
  ],
}
