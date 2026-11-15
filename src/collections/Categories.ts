import type { CollectionConfig } from 'payload'

export const Categories: CollectionConfig = {
  slug: 'categories',
  admin: {
    useAsTitle: 'name',
    defaultColumns: ['name', 'slug', 'parentMenuId', 'showInBottomBar'],
  },
  access: {
    read: () => true,
    create: () => true,
    update: () => true,
  },
  fields: [
    {
      name: 'name',
      type: 'text',
      required: true,
    },
    {
      name: 'slug',
      type: 'text',
      required: true,
      unique: true,
      index: true,
    },
    {
      name: 'menuId',
      type: 'text',
      required: true,
      defaultValue: 'main',
    },
    {
      name: 'parentMenuId',
      type: 'text',
    },
    {
      name: 'submenuTargetId',
      type: 'text',
    },
    {
      name: 'iconName',
      type: 'text',
    },
    {
      name: 'showInBottomBar',
      type: 'checkbox',
      defaultValue: false,
    },
    {
      name: 'sortOrder',
      type: 'number',
      defaultValue: 0,
    },
  ],
}
