import { describe, it, expect, vi } from 'vitest'
import axios from 'axios'
import type { Order } from '../../../payload-types'

const mockResendSend = vi.fn()

vi.mock('resend', () => {
  return {
    Resend: class MockResend {
      emails = {
        send: (...args: unknown[]) => mockResendSend(...args),
      }
    },
  }
})

import {
  API_CONFIG,
  buildOrderTemplateDataFromOrder,
  generateOrderDocumentOnDemand,
  generateViaApi,
  notifyAdminOfNewOrder,
  sendAdminNewOrderEmail,
  sendRenderedEmailWithAttachments,
} from '../document-email-service'

describe('src/lib/utils/document-email-service unit tests', () => {
  const mockOrder: Order = {
    id: 101,
    orderId: 'ORD-UNIT-101',
    invoiceNumber: 'INV-2026-00101',
    receiptNumber: 'RCP-2026-00101',
    issuedAt: '2026-11-23T12:00:00.000Z',
    customerName: 'Morgan Chase',
    customerEmail: 'morgan@example.com',
    customerPhone: '+1-555-0199',
    shippingAddress: '123 High Street, New York, NY',
    paymentOption: 'pay_on_delivery',
    paymentMethodLabel: 'Cash / Card on Delivery',
    fulfillmentMethod: 'DELIVERY',
    paymentStatus: 'PENDING',
    orderStatus: 'CONFIRMED',
    items: [
      {
        id: 'item_1',
        productId: 'prod_1',
        variantSku: 'SHIRT-SLM-M',
        title: 'Slim Fit Pima Shirt',
        quantity: 2,
        unitPrice: 4500, // $45.00
        lineTotal: 9000, // $90.00
        size: 'M',
        color: 'Onyx',
      },
    ],
    totals: {
      subTotal: 9000, // $90.00
      tax: 720, // $7.20
      shipping: 600, // $6.00
      grandTotal: 10320, // $103.20
    },
    documentHistory: [],
    statusTimeline: [],
    createdAt: '2026-11-23T12:00:00.000Z',
    updatedAt: '2026-11-23T12:00:00.000Z',
  }

  describe('API_CONFIG', () => {
    it('provides sensible defaults and configuration fields', () => {
      expect(API_CONFIG.templates.invoicePdf).toBeTruthy()
      expect(API_CONFIG.templates.receiptPdf).toBeTruthy()
      expect(API_CONFIG.templates.receiptEmail).toBeTruthy()
      expect(API_CONFIG.resend.from).toContain('Storefront Orders')
      expect(API_CONFIG.resend.adminEmail).toBeTruthy()
    })
  })

  describe('buildOrderTemplateDataFromOrder', () => {
    it('transforms order fields and converts prices from cents to dollars', () => {
      const templateData = buildOrderTemplateDataFromOrder(mockOrder)
      expect(templateData.orderId).toBe('ORD-UNIT-101')
      expect(templateData.customer.name).toBe('Morgan Chase')
      expect(templateData.customer.address).toBe('123 High Street, New York, NY')
      expect(templateData.paymentSummary.status).toBe('PENDING')

      expect(templateData.items[0]).toEqual({
        id: 'prod_1',
        variantSku: 'SHIRT-SLM-M',
        title: 'Slim Fit Pima Shirt',
        brand: '',
        category: '',
        subcategory: '',
        size: 'M',
        color: 'Onyx',
        quantity: 2,
        unitPrice: 45,
        lineTotal: 90,
      })

      expect(templateData.totals).toEqual({
        subTotal: 90,
        tax: 7.2,
        shipping: 6,
        grandTotal: 103.2,
      })
    })

    it('uses collection location for COLLECTION fulfillment orders', () => {
      const collectionOrder: Order = {
        ...mockOrder,
        fulfillmentMethod: 'COLLECTION',
        collectionLocation: 'SoHo Flagship ComposeIt',
      }
      const data = buildOrderTemplateDataFromOrder(collectionOrder)
      expect(data.customer.address).toBe('SoHo Flagship ComposeIt')
    })

    it('maps fiscal data when fiscalReceipt is present on order', () => {
      const fiscalOrder: Order = {
        ...mockOrder,
        fiscalReceipt: {
          deviceId: 1234,
          receiptGlobalNo: 5678,
          receiptCounter: 99,
          qrData: 'https://fdms.zimra.co.zw/verify/xyz',
          submittedAt: '2026-11-23T12:05:00.000Z',
        },
      }
      const data = buildOrderTemplateDataFromOrder(fiscalOrder)
      expect(data.fiscal).toEqual({
        deviceId: 1234,
        fiscalDayNo: undefined,
        receiptGlobalNo: 5678,
        receiptCounter: 99,
        qrData: 'https://fdms.zimra.co.zw/verify/xyz',
        submittedAt: '2026-11-23T12:05:00.000Z',
      })
    })
  })

  describe('sendAdminNewOrderEmail and notifyAdminOfNewOrder', () => {
    it('notifies admin via simple email with details and appropriate action guidance', async () => {
      const result = await sendAdminNewOrderEmail({
        order: mockOrder,
        adminEmail: 'ops-lead@thestore.local',
      })

      expect(result.to).toBe('ops-lead@thestore.local')
      expect(result.subject).toContain('[New Order] ORD-UNIT-101')
      expect(result.subject).toContain('Morgan Chase')
      expect(result.subject).toContain('$103.20')
      expect(result.templateId).toBe('raw_email_admin_order_notification')
      expect(result.attachmentsCount).toBe(0)
      // Falls back to queued_stream when no API key is provided
      expect(result.status).toBe('queued_stream')
    })

    it('alias notifyAdminOfNewOrder functions identically', async () => {
      const result = await notifyAdminOfNewOrder(mockOrder)
      expect(result.subject).toContain('ORD-UNIT-101')
      expect(result.to).toBe(API_CONFIG.resend.adminEmail)
    })

    it('sends via Resend when RESEND_API_KEY is present', async () => {
      const prevKey = process.env.RESEND_API_KEY
      process.env.RESEND_API_KEY = 're_test_mock_resend_api_key'

      mockResendSend.mockResolvedValueOnce({
        data: { id: 'email_resend_123' },
        error: null,
      })

      try {
        const result = await sendAdminNewOrderEmail({
          order: mockOrder,
          adminEmail: 'admin-orders@thestore.com',
        })

        expect(mockResendSend).toHaveBeenCalledTimes(3)
        const sendArgs = mockResendSend.mock.calls[2][0]
        expect(sendArgs.to).toBe('admin-orders@thestore.com')
        expect(sendArgs.subject).toContain('ORD-UNIT-101')
        expect(sendArgs.react).toBeTruthy()
        expect(result.status).toBe('sent_resend')
        expect(result.messageId).toBe('email_resend_123')
      } finally {
        if (prevKey === undefined) {
          delete process.env.RESEND_API_KEY
        } else {
          process.env.RESEND_API_KEY = prevKey
        }
      }
    })
  })

  describe('generateViaApi', () => {
    it('POSTs payload to ComposeIt endpoint', async () => {
      vi.spyOn(axios, 'post').mockResolvedValueOnce({
        data: {
          pdf: {
            url: 'https://cdn.composeit.local/inv.pdf',
            sizeBytes: 1200,
            mimeType: 'application/pdf',
            checksum: 'c1',
          },
        },
      })

      const res = await generateViaApi({
        templateId: 'tpl_inv',
        formats: ['pdf'],
        filename: 'Invoice.pdf',
        data: buildOrderTemplateDataFromOrder(mockOrder),
      })

      expect(res.templateId).toBe('tpl_inv')
      expect(res.pdf?.url).toBe('https://cdn.composeit.local/inv.pdf')
      expect(res.filename).toBe('Invoice.pdf')
    })
  })

  describe('generateOrderDocumentOnDemand', () => {
    it('generates INVOICE document on demand', async () => {
      vi.spyOn(axios, 'post').mockResolvedValueOnce({
        data: {
          pdf: {
            url: 'https://cdn.composeit.local/invoice.pdf',
            sizeBytes: 5000,
            mimeType: 'application/pdf',
            checksum: 'inv_hash',
          },
        },
      })

      const doc = await generateOrderDocumentOnDemand(mockOrder, 'INVOICE')
      expect(doc.documentType).toBe('INVOICE')
      expect(doc.documentNumber).toBe('INV-2026-00101')
      expect(doc.filename).toBe('Invoice-INV-2026-00101.pdf')
      expect(doc.pdfUrl).toBe('https://cdn.composeit.local/invoice.pdf')
    })

    it('generates RECEIPT document on demand', async () => {
      vi.spyOn(axios, 'post').mockResolvedValueOnce({
        data: {
          pdf: {
            url: 'https://cdn.composeit.local/receipt.pdf',
            sizeBytes: 4000,
            mimeType: 'application/pdf',
            checksum: 'rcp_hash',
          },
        },
      })

      const doc = await generateOrderDocumentOnDemand(mockOrder, 'RECEIPT')
      expect(doc.documentType).toBe('RECEIPT')
      expect(doc.documentNumber).toBe('RCP-2026-00101')
      expect(doc.filename).toBe('Receipt-RCP-2026-00101.pdf')
      expect(doc.pdfUrl).toBe('https://cdn.composeit.local/receipt.pdf')
    })
  })

  describe('sendRenderedEmailWithAttachments', () => {
    it('prepares attachments and falls back to queued_stream without RESEND_API_KEY', async () => {
      const renderedEmail = {
        templateId: 'tpl_email',
        html: {
          htmlDocument: '<p>Order Confirmation</p>',
          checksum: 'c',
          mimeType: 'text/html',
          url: '',
          sizeBytes: 20,
        },
        payloadSent: {} as never,
      }
      const attachments = [
        {
          templateId: 'tpl_inv',
          filename: 'Invoice.pdf',
          pdf: {
            url: 'https://cdn.local/inv.pdf',
            sizeBytes: 10,
            mimeType: 'application/pdf',
            checksum: 'c',
          },
          payloadSent: {} as never,
        },
      ]

      const res = await sendRenderedEmailWithAttachments({
        to: 'customer@example.com',
        subject: 'Your Order',
        renderedEmail,
        attachments,
      })

      expect(res.to).toBe('customer@example.com')
      expect(res.attachmentsCount).toBe(1)
      expect(res.attachments[0].filename).toBe('Invoice.pdf')
      expect(res.status).toBe('queued_stream')
    })
  })
})
