import type { CollectionConfig } from 'payload'

export const StockReservations: CollectionConfig = {
  slug: 'stock-reservations',
  admin: {
    useAsTitle: 'reservationKey',
    defaultColumns: ['reservationKey', 'orderId', 'status', 'expiresAt'],
  },
  access: {
    read: () => true,
    create: () => true,
    update: () => true,
  },
  fields: [
    {
      name: 'reservationKey',
      type: 'text',
      required: true,
      unique: true,
      index: true,
    },
    {
      name: 'orderId',
      type: 'text',
      index: true,
    },
    {
      name: 'status',
      type: 'select',
      required: true,
      defaultValue: 'RESERVED',
      options: [
        { label: 'Reserved (Locked)', value: 'RESERVED' },
        { label: 'Committed (Sold)', value: 'COMMITTED' },
        { label: 'Released (Returned to Stock)', value: 'RELEASED' },
        { label: 'Expired', value: 'EXPIRED' },
      ],
    },
    {
      name: 'expiresAt',
      type: 'text',
      required: true,
    },
    {
      name: 'items',
      type: 'array',
      fields: [
        { name: 'productSlug', type: 'text', required: true },
        { name: 'variantSku', type: 'text', required: true },
        { name: 'quantity', type: 'number', required: true },
      ],
    },
    {
      name: 'failureReason',
      type: 'text',
    },
  ],
}
