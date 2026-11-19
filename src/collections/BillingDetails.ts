import type { CollectionConfig } from 'payload'

export const BillingDetails: CollectionConfig = {
  slug: 'billing-details',
  admin: {
    useAsTitle: 'neonUserId',
    defaultColumns: ['neonUserId', 'phone', 'updatedAt'],
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
      name: 'phone',
      type: 'text',
    },
    {
      name: 'shippingAddress',
      type: 'textarea',
    },
  ],
}
