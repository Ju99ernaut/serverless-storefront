import type { CollectionConfig } from 'payload'
import { usersAccess } from '../lib/access'

export const Users: CollectionConfig = {
  slug: 'users',
  admin: {
    useAsTitle: 'email',
    defaultColumns: ['name', 'email', 'role'],
  },
  auth: true,
  access: usersAccess,
  fields: [
    {
      name: 'name',
      type: 'text',
      defaultValue: 'Admin',
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
  ],
}
