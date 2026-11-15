import type { CollectionConfig } from 'payload'

export const Users: CollectionConfig = {
  slug: 'users',
  admin: {
    useAsTitle: 'email',
    defaultColumns: ['name', 'email', 'role', 'authProvider'],
  },
  auth: true,
  access: {
    read: () => true,
    create: () => true,
    update: () => true,
    delete: ({ req: { user } }) => Boolean(user?.role === 'admin'),
  },
  fields: [
    {
      name: 'name',
      type: 'text',
      defaultValue: 'Storefront Customer',
    },
    {
      name: 'role',
      type: 'select',
      defaultValue: 'customer',
      options: [
        { label: 'Customer', value: 'customer' },
        { label: 'Admin', value: 'admin' },
      ],
      required: true,
    },
    {
      name: 'phone',
      type: 'text',
    },
    {
      name: 'neonAuthUserId',
      type: 'text',
      index: true,
    },
    {
      name: 'authProvider',
      type: 'select',
      defaultValue: 'neon',
      options: [
        { label: 'Neon Managed Better Auth (Email)', value: 'neon' },
        { label: 'Google OAuth (Neon Managed Better Auth)', value: 'google' },
        { label: 'Payload Local Auth', value: 'local' },
      ],
    },
    {
      name: 'avatarUrl',
      type: 'text',
    },
    {
      name: 'shippingAddresses',
      type: 'array',
      fields: [
        { name: 'label', type: 'text', defaultValue: 'Home' },
        { name: 'fullName', type: 'text', required: true },
        { name: 'streetAddress', type: 'textarea', required: true },
        { name: 'city', type: 'text' },
        { name: 'postalCode', type: 'text' },
        { name: 'country', type: 'text', defaultValue: 'United States' },
        { name: 'phone', type: 'text' },
        { name: 'isDefault', type: 'checkbox', defaultValue: false },
      ],
    },
    {
      name: 'wishlistProductSlugs',
      type: 'json',
      defaultValue: [],
    },
    {
      name: 'savedCart',
      type: 'json',
      defaultValue: [],
    },
  ],
}
