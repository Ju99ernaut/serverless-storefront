import type { CollectionConfig } from 'payload'
import { ordersAccess } from '../lib/access'

export const Orders: CollectionConfig = {
  slug: 'orders',
  admin: {
    useAsTitle: 'orderId',
    defaultColumns: [
      'orderId',
      'customerName',
      'paymentOption',
      'paymentStatus',
      'orderStatus',
      'createdAt',
    ],
  },
  access: ordersAccess,
  fields: [
    {
      name: 'orderManagementControls',
      type: 'ui',
      admin: {
        position: 'sidebar',
        components: {
          Field: '/components/admin/order-management-controls#OrderManagementControls',
        },
      },
    },
    {
      name: 'orderId',
      type: 'text',
      required: true,
      unique: true,
      index: true,
    },
    {
      name: 'invoiceNumber',
      type: 'text',
      required: true,
    },
    {
      name: 'receiptNumber',
      type: 'text',
      required: true,
    },
    {
      name: 'user',
      type: 'relationship',
      relationTo: 'users',
      index: true,
    },
    {
      name: 'neonUserId',
      type: 'text',
      index: true,
    },
    {
      name: 'issuedAt',
      type: 'text',
    },
    {
      name: 'customerEmail',
      type: 'text',
      required: true,
      index: true,
    },
    {
      name: 'customerName',
      type: 'text',
      required: true,
    },
    {
      name: 'customerPhone',
      type: 'text',
    },
    {
      name: 'shippingAddress',
      type: 'textarea',
    },
    {
      name: 'collectionLocation',
      type: 'text',
    },
    {
      name: 'paymentOption',
      type: 'select',
      required: true,
      options: [
        { label: 'Pay & Delivery (Pay Now + Home Delivery)', value: 'pay_and_delivery' },
        { label: 'Pay then Collect (Pay Now + Store Pickup)', value: 'pay_then_collect' },
        { label: 'Pay on Delivery (Cash/Card on Delivery)', value: 'pay_on_delivery' },
        { label: 'Pay on Collection (Pay at Store Pickup)', value: 'pay_on_collection' },
      ],
    },
    {
      name: 'paymentMethodLabel',
      type: 'text',
    },
    {
      name: 'fulfillmentMethod',
      type: 'select',
      required: true,
      options: [
        { label: 'Home Delivery', value: 'DELIVERY' },
        { label: 'Store Collection', value: 'COLLECTION' },
      ],
    },
    {
      name: 'paymentStatus',
      type: 'select',
      required: true,
      defaultValue: 'PENDING',
      options: [
        { label: 'Pending', value: 'PENDING' },
        { label: 'Paid', value: 'PAID' },
        { label: 'Failed', value: 'FAILED' },
        { label: 'Refunded', value: 'REFUNDED' },
      ],
    },
    {
      name: 'orderStatus',
      type: 'select',
      required: true,
      defaultValue: 'CONFIRMED',
      options: [
        { label: 'Pending', value: 'PENDING' },
        { label: 'Confirmed', value: 'CONFIRMED' },
        { label: 'Processing', value: 'PROCESSING' },
        { label: 'Ready for Collection', value: 'READY_FOR_COLLECTION' },
        { label: 'Out for Delivery', value: 'OUT_FOR_DELIVERY' },
        { label: 'Completed', value: 'COMPLETED' },
        { label: 'Cancelled', value: 'CANCELLED' },
      ],
    },
    {
      name: 'cardLast4',
      type: 'text',
    },
    {
      name: 'paidAt',
      type: 'text',
    },
    {
      name: 'items',
      type: 'array',
      fields: [
        { name: 'productId', type: 'text', required: true },
        { name: 'productSlug', type: 'text' },
        { name: 'variantSku', type: 'text', required: true },
        { name: 'title', type: 'text', required: true },
        { name: 'brand', type: 'text' },
        { name: 'category', type: 'text' },
        { name: 'subcategory', type: 'text' },
        { name: 'size', type: 'text' },
        { name: 'color', type: 'text' },
        { name: 'quantity', type: 'number', required: true },
        { name: 'unitPrice', type: 'number', required: true },
        { name: 'lineTotal', type: 'number', required: true },
        { name: 'imageUrl', type: 'text' },
      ],
    },
    {
      name: 'totals',
      type: 'group',
      fields: [
        { name: 'subTotal', type: 'number', required: true },
        { name: 'tax', type: 'number', required: true },
        { name: 'shipping', type: 'number', required: true },
        { name: 'grandTotal', type: 'number', required: true },
      ],
    },
    {
      name: 'documentHistory',
      type: 'array',
      fields: [
        {
          name: 'documentType',
          type: 'select',
          required: true,
          options: [
            { label: 'Invoice', value: 'INVOICE' },
            { label: 'Receipt', value: 'RECEIPT' },
          ],
        },
        { name: 'documentNumber', type: 'text', required: true },
        { name: 'filename', type: 'text', required: true },
        { name: 'templateId', type: 'text', required: true },
        { name: 'generatedAt', type: 'text', required: true },
      ],
    },
    {
      name: 'statusTimeline',
      type: 'array',
      fields: [
        { name: 'status', type: 'text', required: true },
        { name: 'label', type: 'text', required: true },
        { name: 'timestamp', type: 'text', required: true },
        { name: 'note', type: 'text' },
      ],
    },
    {
      name: 'fiscalReceipt',
      type: 'group',
      fields: [
        { name: 'deviceId', type: 'number' },
        { name: 'fiscalDayNo', type: 'number' },
        { name: 'receiptGlobalNo', type: 'number' },
        { name: 'receiptCounter', type: 'number' },
        { name: 'qrData', type: 'text' },
        { name: 'submittedAt', type: 'text' },
      ],
    },
  ],
}
