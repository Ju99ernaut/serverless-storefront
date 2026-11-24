import { describe, it, expect, beforeAll, afterAll, vi } from 'vitest'
import axios from 'axios'
import { start } from 'workflow/api'
import { NextRequest } from 'next/server'
import { POST as postCheckout } from '@/app/(frontend)/api/checkout/route'
import { PATCH as patchOrderRoute } from '@/app/(frontend)/api/storefront/orders/route'
import {
  createProductReview,
  fetchProductBySlugWithReviews,
  getBillingDetails,
  getCartByNeonUserId,
  getCatalogData,
  getOrderByOrderId,
  getOrdersByUser,
  getWishlistByNeonUserId,
  syncCartWithPayload,
  syncWishlistWithPayload,
  toggleWishlistItemInPayload,
  upsertBillingDetails,
} from '@/lib/payload-sdk'
import { releaseVariantStock, reserveVariantStock } from '@/lib/payload-server'
import { isAdminAccess, ordersAccess, ownerByNeonUserIdAccess, reviewsAccess } from '@/lib/access'
import type { PayloadRequest } from 'payload'
import {
  WORKFLOW_TIMEOUT_DEFAULTS,
  executeDurableCheckoutWorkflow,
  getOrderFulfillmentHookToken,
  getOrderPaymentHookToken,
  orderFulfillmentHook,
  orderPaymentHook,
} from '@/workflows/checkout-workflow'
import { PRODUCTS, HOME_BANNERS, INITIAL_REVIEWS } from './products'
import {
  DELIVERY_FEE_CENTS,
  calculateOrderTotalsCents,
  centsToDollars,
  formatCentsAsDollars,
  getProductLowestAvailableVariantStock,
} from '@/lib/utils/data'
import type { Product, Review } from '@/payload-types'

type MockRecord = Record<string, unknown> & {
  id: number
  createdAt?: string
  updatedAt?: string
}

function parseBracketQuery(search: string): Record<string, unknown> {
  const result: Record<string, unknown> = {}
  const params = new URLSearchParams(search)
  for (const [rawKey, value] of params.entries()) {
    const parts = rawKey
      .replace(/\]/g, '')
      .split('[')
      .filter((p) => p.length > 0)
    if (parts.length === 0) continue

    let current: Record<string, unknown> | unknown[] = result
    for (let i = 0; i < parts.length; i++) {
      const part = parts[i]
      const isLast = i === parts.length - 1
      const nextIsIndex = !isLast && /^\d+$/.test(parts[i + 1])

      if (Array.isArray(current)) {
        const idx = Number(part)
        if (isLast) {
          current[idx] = value
        } else {
          if (!current[idx] || typeof current[idx] !== 'object') {
            current[idx] = nextIsIndex ? [] : {}
          }
          current = current[idx] as Record<string, unknown> | unknown[]
        }
      } else {
        if (isLast) {
          current[part] = value
        } else {
          if (!current[part] || typeof current[part] !== 'object') {
            current[part] = nextIsIndex ? [] : {}
          }
          current = current[part] as Record<string, unknown> | unknown[]
        }
      }
    }
  }
  return result
}

function matchesWhere(doc: MockRecord, where: unknown): boolean {
  if (!where || typeof where !== 'object') return true
  const w = where as Record<string, unknown>

  if (Array.isArray(w.or)) {
    return w.or.some((sub) => matchesWhere(doc, sub))
  }
  if (Array.isArray(w.and)) {
    return w.and.every((sub) => matchesWhere(doc, sub))
  }

  for (const [field, cond] of Object.entries(w)) {
    if (field === 'or' || field === 'and') continue
    if (!cond || typeof cond !== 'object') continue
    const op = cond as Record<string, unknown>
    const val = doc[field]

    if ('equals' in op) {
      const target = op.equals
      const normalizedTarget = target === 'true' ? true : target === 'false' ? false : target
      if (val !== normalizedTarget && String(val) !== String(target)) {
        return false
      }
    }
    if ('not_equals' in op) {
      if (val === op.not_equals || String(val) === String(op.not_equals)) {
        return false
      }
    }
    if ('in' in op) {
      const list = Array.isArray(op.in) ? op.in : typeof op.in === 'string' ? op.in.split(',') : []
      if (!list.some((item) => item === val || String(item) === String(val))) {
        return false
      }
    }
    if ('less_than_equal' in op) {
      if (String(val ?? '') > String(op.less_than_equal ?? '')) {
        return false
      }
    }
    if ('greater_than' in op) {
      if (String(val ?? '') <= String(op.greater_than ?? '')) {
        return false
      }
    }
  }

  return true
}

const waitForWorkflowHook = (token: string) =>
  (
    globalThis as unknown as {
      __waitForWorkflowHook__: (token: string, timeoutMs?: number) => Promise<void>
    }
  ).__waitForWorkflowHook__(token)

describe('Storefront End-to-End Payload SDK & Workflow Integration Suite', () => {
  let collectionsStore: Record<string, MockRecord[]>
  let nextIds: Record<string, number>

  const getLiveVariant = (slug: string, sku: string) => {
    const prod = (collectionsStore.products as unknown as Product[]).find((p) => p.slug === slug)!
    return prod.variants!.find((v) => v.sku === sku)!
  }

  beforeAll(() => {
    collectionsStore = {
      products: structuredClone(PRODUCTS) as unknown as MockRecord[],
      banners: structuredClone(HOME_BANNERS) as unknown as MockRecord[],
      reviews: structuredClone(INITIAL_REVIEWS) as unknown as MockRecord[],
      'billing-details': [],
      carts: [],
      wishlists: [],
      orders: [],
      'stock-reservations': [],
    }
    nextIds = {
      products: PRODUCTS.length + 1,
      banners: HOME_BANNERS.length + 1,
      reviews: INITIAL_REVIEWS.length + 1,
      'billing-details': 1,
      carts: 1,
      wishlists: 1,
      orders: 1,
      'stock-reservations': 1,
    }

    const buildMockComposeItResponse = (parsed: {
      formats?: string[]
      data?: { orderId?: string; documentType?: string }
    }) => {
      const orderId = parsed.data?.orderId || 'ORD-TEST'
      const docType = parsed.data?.documentType === 'RECEIPT' ? 'receipt' : 'invoice'
      const wantsPdf = !parsed.formats || parsed.formats.includes('pdf')
      const wantsHtml = !parsed.formats || parsed.formats.includes('html')
      const htmlDocument = `<!DOCTYPE html><html><body><h1>Order ${orderId}</h1></body></html>`

      return {
        ...(wantsPdf
          ? {
              pdf: {
                url: `https://api.composeit.local/ephemeral/${encodeURIComponent(orderId)}-${docType}.pdf`,
                sizeBytes: 28450,
                mimeType: 'application/pdf',
                checksum: `sha256_${orderId.toLowerCase()}_${docType}`,
              },
            }
          : {}),
        ...(wantsHtml
          ? {
              html: {
                htmlDocument,
                checksum: `sha256_${orderId.toLowerCase()}_html`,
                mimeType: 'text/html',
                url: `https://api.composeit.local/ephemeral/${encodeURIComponent(orderId)}.html`,
                sizeBytes: htmlDocument.length,
              },
            }
          : {}),
      }
    }

    vi.spyOn(axios, 'post').mockImplementation(async (_url: string, data?: unknown) => {
      const parsed =
        data && typeof data === 'object'
          ? (data as {
              formats?: string[]
              data?: { orderId?: string; documentType?: string }
            })
          : {}
      return { data: buildMockComposeItResponse(parsed) }
    })

    vi.stubGlobal(
      'fetch',
      vi.fn(async (input: string | URL | Request, init?: RequestInit) => {
        const rawUrl =
          typeof input === 'string' ? input : input instanceof URL ? input.toString() : input.url
        const method = (init?.method || 'GET').toUpperCase()
        const urlObj = new URL(rawUrl, 'http://localhost:3000')

        if (urlObj.pathname.startsWith('/api/')) {
          const rest = urlObj.pathname.slice('/api/'.length)
          const [collection, idSegment] = rest.split('/')

          if (collection && collectionsStore[collection]) {
            const docs = collectionsStore[collection]
            const query = parseBracketQuery(urlObj.search) as {
              where?: unknown
              sort?: string
              limit?: string
            }

            if (method === 'GET') {
              if (idSegment) {
                const found = docs.find((d) => String(d.id) === idSegment)
                return new Response(JSON.stringify(found || null), {
                  status: found ? 200 : 404,
                  headers: { 'Content-Type': 'application/json' },
                })
              }

              let filtered = docs.filter((d) => matchesWhere(d, query.where))
              if (query.sort) {
                const desc = query.sort.startsWith('-')
                const sortField = desc ? query.sort.slice(1) : query.sort
                filtered = [...filtered].sort((a, b) => {
                  const av = a[sortField]
                  const bv = b[sortField]
                  if (av === bv) return 0
                  const cmp = String(av ?? '') < String(bv ?? '') ? -1 : 1
                  return desc ? -cmp : cmp
                })
              }
              const limit = Number(query.limit) || 10
              const sliced = filtered.slice(0, limit)
              return new Response(
                JSON.stringify({
                  docs: sliced,
                  totalDocs: filtered.length,
                  limit,
                  page: 1,
                  totalPages: 1,
                  hasNextPage: false,
                  hasPrevPage: false,
                }),
                { status: 200, headers: { 'Content-Type': 'application/json' } },
              )
            }

            if (method === 'POST') {
              const payloadData = typeof init?.body === 'string' ? JSON.parse(init.body) : {}
              const now = new Date().toISOString()
              const newDoc: MockRecord = {
                ...payloadData,
                id: nextIds[collection]++,
                createdAt: now,
                updatedAt: now,
              }
              docs.push(newDoc)
              return new Response(JSON.stringify({ doc: newDoc }), {
                status: 201,
                headers: { 'Content-Type': 'application/json' },
              })
            }

            if (method === 'PATCH' && idSegment) {
              const patchData = typeof init?.body === 'string' ? JSON.parse(init.body) : {}
              const idx = docs.findIndex((d) => String(d.id) === idSegment)
              if (idx < 0) {
                return new Response(JSON.stringify({ errors: [{ message: 'Not found' }] }), {
                  status: 404,
                  headers: { 'Content-Type': 'application/json' },
                })
              }
              const updated: MockRecord = {
                ...docs[idx],
                ...patchData,
                id: docs[idx].id,
                updatedAt: new Date().toISOString(),
              }
              docs[idx] = updated
              return new Response(JSON.stringify({ doc: updated }), {
                status: 200,
                headers: { 'Content-Type': 'application/json' },
              })
            }

            if (method === 'DELETE' && idSegment) {
              const idx = docs.findIndex((d) => String(d.id) === idSegment)
              const deleted = idx >= 0 ? docs.splice(idx, 1)[0] : null
              return new Response(JSON.stringify({ doc: deleted }), {
                status: deleted ? 200 : 404,
                headers: { 'Content-Type': 'application/json' },
              })
            }
          }
        }

        const parsed =
          typeof init?.body === 'string'
            ? (JSON.parse(init.body) as {
                formats?: string[]
                data?: { orderId?: string; documentType?: string }
              })
            : {}

        return new Response(JSON.stringify(buildMockComposeItResponse(parsed)), {
          status: 200,
          headers: { 'Content-Type': 'application/json' },
        })
      }),
    )
  })

  afterAll(() => {
    vi.restoreAllMocks()
    vi.unstubAllGlobals()
  })

  it('fetches catalog products and banners via Payload SDK and detects low-stock variants', async () => {
    const catalog = await getCatalogData()

    expect(Array.isArray(catalog.products)).toBe(true)
    expect(catalog.products.length).toBeGreaterThan(0)
    expect(Array.isArray(catalog.banners)).toBe(true)
    expect(catalog.banners.length).toBeGreaterThan(0)

    const oxford = catalog.products.find((p: Product) => p.slug === 'classic-oxford-button-down')
    expect(oxford).toBeDefined()
    expect(oxford!.price).toBe(8900)
    expect(formatCentsAsDollars(oxford!.price)).toBe('$89.00')

    const stockInfo = getProductLowestAvailableVariantStock(oxford!)
    expect(stockInfo.hasLowStockVariant).toBe(true)
    expect(stockInfo.minAvailable).toBeLessThanOrEqual(5)

    const detail = await fetchProductBySlugWithReviews('classic-oxford-button-down')
    expect(detail.product.slug).toBe('classic-oxford-button-down')
    expect(detail.reviews.length).toBeGreaterThan(0)
    expect(detail.relatedProducts.length).toBeGreaterThan(0)
  })

  it('prevents double allocation under concurrent reservations and releases stock on failed payment', async () => {
    const products = collectionsStore.products as unknown as Product[]
    const oxford = products.find((p) => p.slug === 'classic-oxford-button-down')!
    const variant = oxford.variants!.find((v) => v.sku === 'PROD-1-SKY-S')!
    const initialStock = variant.stock
    expect(initialStock).toBe(2)

    // 1. Declined payment via payment provider hook -> Workflow reserves then compensates/releases stock
    const failedOrderId = 'ORD-TEST-FAIL-1'
    const failedReq = new NextRequest('http://localhost:3000/api/checkout', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        idempotencyKey: 'res_test_fail_1',
        orderId: failedOrderId,
        paymentOption: 'pay_and_delivery',
        awaitPaymentHook: true,
        customer: {
          name: 'Alex Rivera',
          email: 'alex.rivera@example.com',
          address: '742 Evergreen Terrace, San Francisco, CA',
        },
        payment: {
          cardholderName: 'Alex Rivera',
          cardNumber: '4242424242424242',
          expiry: '08/29',
        },
        items: [
          {
            id: String(oxford.id),
            slug: oxford.slug,
            variantSku: variant.sku,
            title: oxford.title,
            brand: oxford.brand,
            category: oxford.category,
            subcategory: oxford.subcategory,
            size: variant.size,
            color: variant.color,
            price: oxford.price,
            quantity: 2,
            images: ['/images/shirt.png'],
          },
        ],
      }),
    })

    const failedResPromise = postCheckout(failedReq)
    await waitForWorkflowHook(getOrderPaymentHookToken(failedOrderId))
    await orderPaymentHook.resume(getOrderPaymentHookToken(failedOrderId), {
      authorized: false,
      cardNumber: '4242424242424242',
      error: 'Payment declined by provider.',
    })
    const failedRes = await failedResPromise
    expect(failedRes.status).toBe(402)
    const failedBody = await failedRes.json()
    expect(failedBody.stockReleased).toBe(true)
    expect(getLiveVariant(oxford.slug, variant.sku).reservedStock).toBe(0)
    expect(getLiveVariant(oxford.slug, variant.sku).stock).toBe(initialStock)

    // 2. True concurrent race-condition check via Promise.all on same SKU (stock = 2)
    const [r1, r2] = await Promise.all([
      reserveVariantStock({
        reservationKey: 'res_double_1',
        orderId: 'ORD-DBL-1',
        items: [
          {
            productSlug: oxford.slug,
            variantSku: variant.sku,
            quantity: 2,
          },
        ],
      }),
      reserveVariantStock({
        reservationKey: 'res_double_2',
        orderId: 'ORD-DBL-2',
        items: [
          {
            productSlug: oxford.slug,
            variantSku: variant.sku,
            quantity: 2,
          },
        ],
      }),
    ])

    const outcomes = [r1, r2]
    const succeeded = outcomes.filter((o) => o.success)
    const rejected = outcomes.filter((o) => !o.success)
    expect(succeeded).toHaveLength(1)
    expect(rejected).toHaveLength(1)
    expect(rejected[0].insufficientItems?.[0].available).toBe(0)
    expect(getLiveVariant(oxford.slug, variant.sku).reservedStock).toBe(2)

    await releaseVariantStock(succeeded[0].reservation!.reservationKey, 'Test cleanup')
    expect(getLiveVariant(oxford.slug, variant.sku).reservedStock).toBe(0)

    // 3. Concurrent reservations on different SKUs of the same product must not overwrite each other
    const [skuA, skuB] = await Promise.all([
      reserveVariantStock({
        reservationKey: 'res_diff_sku_1',
        orderId: 'ORD-DIFF-1',
        items: [
          {
            productSlug: oxford.slug,
            variantSku: 'PROD-1-SKY-S',
            quantity: 1,
          },
        ],
      }),
      reserveVariantStock({
        reservationKey: 'res_diff_sku_2',
        orderId: 'ORD-DIFF-2',
        items: [
          {
            productSlug: oxford.slug,
            variantSku: 'PROD-1-SKY-M',
            quantity: 1,
          },
        ],
      }),
    ])
    expect(skuA.success).toBe(true)
    expect(skuB.success).toBe(true)
    expect(getLiveVariant(oxford.slug, 'PROD-1-SKY-S').reservedStock).toBe(1)
    expect(getLiveVariant(oxford.slug, 'PROD-1-SKY-M').reservedStock).toBe(1)

    await releaseVariantStock('res_diff_sku_1', 'Test cleanup A')
    await releaseVariantStock('res_diff_sku_2', 'Test cleanup B')
    expect(getLiveVariant(oxford.slug, 'PROD-1-SKY-S').reservedStock).toBe(0)
    expect(getLiveVariant(oxford.slug, 'PROD-1-SKY-M').reservedStock).toBe(0)
  })

  it('exposes configurable defaults (30m payment, 8h pay-on-collection, 24h pay-on-delivery) and stops + releases stock if payment times out', async () => {
    expect(WORKFLOW_TIMEOUT_DEFAULTS.paymentWaitTimeout).toBe('30m')
    expect(WORKFLOW_TIMEOUT_DEFAULTS.payOnCollectionTimeout).toBe('8h')
    expect(WORKFLOW_TIMEOUT_DEFAULTS.payOnDeliveryTimeout).toBe('24h')

    const products = collectionsStore.products as unknown as Product[]
    const oxford = products.find((p) => p.slug === 'classic-oxford-button-down')!
    const variant = oxford.variants!.find((v) => v.sku === 'PROD-1-SKY-S')!
    const startStock = variant.stock

    // 1. Pay & Delivery: payment times out after configurable window -> stops workflow & releases stock
    const timeoutRun = await start(executeDurableCheckoutWorkflow, [
      {
        orderId: 'ORD-PAY-TIMEOUT-1',
        paymentOption: 'pay_and_delivery',
        awaitPaymentHook: true,
        timeouts: { paymentWaitTimeout: '40ms' },
        customer: {
          name: 'Timeout Tester',
          email: 'timeout@example.com',
          address: '100 Main St',
        },
        items: [
          {
            id: String(oxford.id),
            slug: oxford.slug,
            variantSku: variant.sku,
            title: oxford.title,
            brand: oxford.brand,
            category: oxford.category,
            subcategory: oxford.subcategory,
            size: variant.size,
            color: variant.color,
            price: oxford.price,
            quantity: 1,
          },
        ],
      },
    ])

    const timeoutResult = await timeoutRun.returnValue
    expect(timeoutResult.success).toBe(false)
    expect(timeoutResult.status).toBe(408)
    expect(timeoutResult.stockReleased).toBe(true)
    expect(getLiveVariant(oxford.slug, variant.sku).reservedStock).toBe(0)
    expect(getLiveVariant(oxford.slug, variant.sku).stock).toBe(startStock)
  })

  it('handles pay_then_collect (payment -> invoice/receipt email -> reserved -> Ready for Collection -> done or Cancelled)', async () => {
    const products = collectionsStore.products as unknown as Product[]
    const boot = products.find((p) => p.slug === 'milan-leather-chelsea-boot')!
    const targetVariant = boot.variants![0]
    const startStock = targetVariant.stock

    // 1. Pay then collect: payment received via hook -> email w/ invoice+receipt -> stock reserved -> marked READY_FOR_COLLECTION -> completes & deducts stock
    const collectOrderId = 'ORD-PTC-READY-1'
    const run = await start(executeDurableCheckoutWorkflow, [
      {
        orderId: collectOrderId,
        paymentOption: 'pay_then_collect',
        awaitPaymentHook: true,
        waitForFulfillment: true,
        timeouts: { paymentWaitTimeout: '200ms' },
        customer: {
          name: 'Alex Rivera',
          email: 'alex.rivera@example.com',
          collectionLocation: 'Flagship Storefront ComposeIt — SoHo',
        },
        items: [
          {
            id: String(boot.id),
            slug: boot.slug,
            variantSku: targetVariant.sku,
            title: boot.title,
            brand: boot.brand,
            category: boot.category,
            subcategory: boot.subcategory,
            size: targetVariant.size,
            color: targetVariant.color,
            price: boot.price,
            quantity: 1,
          },
        ],
      },
    ])

    await waitForWorkflowHook(getOrderPaymentHookToken(collectOrderId))
    await orderPaymentHook.resume(getOrderPaymentHookToken(collectOrderId), {
      authorized: true,
      cardNumber: '4242424242424242',
    })

    // While waiting for admin input, stock is reserved (not yet deducted) and order + invoice/receipt history are created
    await waitForWorkflowHook(getOrderFulfillmentHookToken(collectOrderId))
    const midOrder = await getOrderByOrderId(collectOrderId)
    expect(midOrder).not.toBeNull()
    expect(midOrder?.paymentStatus).toBe('PAID')
    expect(midOrder?.totals.shipping).toBe(0)
    expect(midOrder?.totals.subTotal).toBe(boot.price)
    expect(midOrder?.documentHistory?.map((d) => d.documentType)).toEqual(['INVOICE', 'RECEIPT'])
    expect('documents' in (midOrder ?? {})).toBe(false)
    expect(getLiveVariant(boot.slug, targetVariant.sku).reservedStock).toBe(1)
    expect(getLiveVariant(boot.slug, targetVariant.sku).stock).toBe(startStock)

    // Admin marks as Ready for Collection -> workflow completes & stock is deducted
    await orderFulfillmentHook.resume(getOrderFulfillmentHookToken(collectOrderId), {
      nextStatus: 'READY_FOR_COLLECTION',
      note: 'Garments ready at SoHo pickup lounge.',
    })

    const finalResult = await run.returnValue
    expect(finalResult.success).toBe(true)
    if (finalResult.success) {
      expect(finalResult.fulfillmentOutcome?.finalStatus).toBe('READY_FOR_COLLECTION')
      expect(finalResult.fulfillmentOutcome?.stockCommitted).toBe(true)
    }
    expect(getLiveVariant(boot.slug, targetVariant.sku).reservedStock).toBe(0)
    expect(getLiveVariant(boot.slug, targetVariant.sku).stock).toBe(startStock - 1)

    // 2. Pay then collect cancelled -> releases reserved stock and refunds payment
    const cancelOrderId = 'ORD-PTC-CANCEL-1'
    const cancelRun = await start(executeDurableCheckoutWorkflow, [
      {
        orderId: cancelOrderId,
        paymentOption: 'pay_then_collect',
        waitForFulfillment: true,
        customer: {
          name: 'Alex Rivera',
          email: 'alex.rivera@example.com',
          collectionLocation: 'Flagship Storefront ComposeIt — SoHo',
        },
        payment: {
          cardholderName: 'Alex Rivera',
          cardNumber: '4242424242424242',
          expiry: '08/29',
        },
        items: [
          {
            id: String(boot.id),
            slug: boot.slug,
            variantSku: targetVariant.sku,
            title: boot.title,
            brand: boot.brand,
            category: boot.category,
            subcategory: boot.subcategory,
            size: targetVariant.size,
            color: targetVariant.color,
            price: boot.price,
            quantity: 1,
          },
        ],
      },
    ])

    await waitForWorkflowHook(getOrderFulfillmentHookToken(cancelOrderId))
    expect(getLiveVariant(boot.slug, targetVariant.sku).reservedStock).toBe(1)
    await orderFulfillmentHook.resume(getOrderFulfillmentHookToken(cancelOrderId), {
      nextStatus: 'CANCELLED',
      note: 'Customer requested cancellation.',
    })

    const cancelResult = await cancelRun.returnValue
    expect(cancelResult.success).toBe(true)
    if (cancelResult.success) {
      expect(cancelResult.fulfillmentOutcome?.finalStatus).toBe('CANCELLED')
      expect(cancelResult.fulfillmentOutcome?.stockReleased).toBe(true)
    }
    const cancelledOrder = await getOrderByOrderId(cancelOrderId)
    expect(cancelledOrder?.paymentStatus).toBe('REFUNDED')
    expect(getLiveVariant(boot.slug, targetVariant.sku).reservedStock).toBe(0)
    expect(getLiveVariant(boot.slug, targetVariant.sku).stock).toBe(startStock - 1)
  })

  it('handles pay_and_delivery (reserved -> Out for Delivery -> Delivered deducts stock)', async () => {
    const products = collectionsStore.products as unknown as Product[]
    const boot = products.find((p) => p.slug === 'milan-leather-chelsea-boot')!
    const targetVariant = boot.variants![1]
    const startStock = targetVariant.stock

    const deliveryOrderId = 'ORD-PAD-1'
    const run = await start(executeDurableCheckoutWorkflow, [
      {
        orderId: deliveryOrderId,
        userId: 'neon_usr_alex',
        paymentOption: 'pay_and_delivery',
        waitForFulfillment: true,
        customer: {
          name: 'Alex Rivera',
          email: 'alex.rivera@example.com',
          address: '742 Evergreen Terrace, San Francisco, CA',
        },
        payment: {
          cardholderName: 'Alex Rivera',
          cardNumber: '4242424242424242',
          expiry: '08/29',
        },
        items: [
          {
            id: String(boot.id),
            slug: boot.slug,
            variantSku: targetVariant.sku,
            title: boot.title,
            brand: boot.brand,
            category: boot.category,
            subcategory: boot.subcategory,
            size: targetVariant.size,
            color: targetVariant.color,
            price: boot.price,
            quantity: 1,
          },
        ],
      },
    ])

    await waitForWorkflowHook(getOrderFulfillmentHookToken(deliveryOrderId))
    expect(getLiveVariant(boot.slug, targetVariant.sku).reservedStock).toBe(1)
    expect(getLiveVariant(boot.slug, targetVariant.sku).stock).toBe(startStock)

    // Step 1: Out for delivery (still reserved)
    await orderFulfillmentHook.resume(getOrderFulfillmentHookToken(deliveryOrderId), {
      nextStatus: 'OUT_FOR_DELIVERY',
      note: 'Courier dispatched.',
    })
    await new Promise((r) => setTimeout(r, 20))
    const inTransitOrder = await getOrderByOrderId(deliveryOrderId)
    expect(inTransitOrder?.orderStatus).toBe('OUT_FOR_DELIVERY')
    expect(getLiveVariant(boot.slug, targetVariant.sku).reservedStock).toBe(1)
    expect(getLiveVariant(boot.slug, targetVariant.sku).stock).toBe(startStock)

    // Step 2: Delivered (COMPLETED) -> stock deducted
    await orderFulfillmentHook.resume(getOrderFulfillmentHookToken(deliveryOrderId), {
      nextStatus: 'COMPLETED',
      note: 'Signed at doorstep.',
    })

    const outcome = await run.returnValue
    expect(outcome.success).toBe(true)
    if (outcome.success) {
      expect(outcome.fulfillmentOutcome?.finalStatus).toBe('COMPLETED')
      expect(outcome.fulfillmentOutcome?.stockCommitted).toBe(true)
    }
    expect(getLiveVariant(boot.slug, targetVariant.sku).reservedStock).toBe(0)
    expect(getLiveVariant(boot.slug, targetVariant.sku).stock).toBe(startStock - 1)

    // Generate Invoice PDF on demand via ComposeIt & record only metadata in documentHistory
    const genReq = new NextRequest('http://localhost:3000/api/storefront/orders', {
      method: 'PATCH',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        action: 'generate_document',
        orderId: deliveryOrderId,
        documentType: 'INVOICE',
      }),
    })
    const genRes = await patchOrderRoute(genReq)
    expect(genRes.status).toBe(200)
    const genBody = await genRes.json()
    expect(genBody.document.documentType).toBe('INVOICE')
    expect(genBody.document.pdfUrl).toContain('api.composeit.local/ephemeral')
    expect(genBody.order.documentHistory).toHaveLength(3)

    const expectedTotals = calculateOrderTotalsCents(
      [{ unitPriceCents: boot.price, quantity: 1 }],
      'DELIVERY',
    )
    expect(expectedTotals.shippingCents).toBe(DELIVERY_FEE_CENTS)
    expect(genBody.order.totals).toEqual({
      subTotal: expectedTotals.subTotalCents,
      tax: expectedTotals.taxCents,
      shipping: expectedTotals.shippingCents,
      grandTotal: expectedTotals.grandTotalCents,
    })
    expect(formatCentsAsDollars(genBody.order.totals.grandTotal)).toBe(
      `$${centsToDollars(expectedTotals.grandTotalCents).toFixed(2)}`,
    )

    const lastComposeCall = vi.mocked(axios.post).mock.calls.at(-1)?.[1] as {
      data?: {
        items?: Array<{ unitPrice: number; lineTotal: number }>
        totals?: { subTotal: number; tax: number; shipping: number; grandTotal: number }
      }
    }
    expect(lastComposeCall?.data?.items?.[0].unitPrice).toBe(centsToDollars(boot.price))
    expect(lastComposeCall?.data?.totals).toEqual({
      subTotal: centsToDollars(expectedTotals.subTotalCents),
      tax: centsToDollars(expectedTotals.taxCents),
      shipping: centsToDollars(expectedTotals.shippingCents),
      grandTotal: centsToDollars(expectedTotals.grandTotalCents),
    })
  })

  it('handles pay_on_collection (8h configurable window: ready -> collected deducts stock, timeout releases stock)', async () => {
    const products = collectionsStore.products as unknown as Product[]
    const boot = products.find((p) => p.slug === 'milan-leather-chelsea-boot')!
    const targetVariant = boot.variants![2]
    const startStock = targetVariant.stock

    // 1. Collected within 8h window -> stock deducted and payment marked PAID
    const pocOrderId = 'ORD-POC-OK-1'
    const run = await start(executeDurableCheckoutWorkflow, [
      {
        orderId: pocOrderId,
        paymentOption: 'pay_on_collection',
        waitForFulfillment: true,
        timeouts: { payOnCollectionTimeout: '400ms' },
        customer: {
          name: 'Alex Rivera',
          email: 'alex.rivera@example.com',
          collectionLocation: 'Flagship Storefront ComposeIt — SoHo',
        },
        items: [
          {
            id: String(boot.id),
            slug: boot.slug,
            variantSku: targetVariant.sku,
            title: boot.title,
            brand: boot.brand,
            category: boot.category,
            subcategory: boot.subcategory,
            size: targetVariant.size,
            color: targetVariant.color,
            price: boot.price,
            quantity: 1,
          },
        ],
      },
    ])

    await waitForWorkflowHook(getOrderFulfillmentHookToken(pocOrderId))
    expect(getLiveVariant(boot.slug, targetVariant.sku).reservedStock).toBe(1)

    await orderFulfillmentHook.resume(getOrderFulfillmentHookToken(pocOrderId), {
      nextStatus: 'READY_FOR_COLLECTION',
    })
    await new Promise((r) => setTimeout(r, 20))
    expect((await getOrderByOrderId(pocOrderId))?.orderStatus).toBe('READY_FOR_COLLECTION')
    expect(getLiveVariant(boot.slug, targetVariant.sku).reservedStock).toBe(1)

    await orderFulfillmentHook.resume(getOrderFulfillmentHookToken(pocOrderId), {
      nextStatus: 'COMPLETED',
      note: 'Paid in store & collected.',
    })
    const res = await run.returnValue
    expect(res.success).toBe(true)
    if (res.success) {
      expect(res.fulfillmentOutcome?.stockCommitted).toBe(true)
    }
    expect((await getOrderByOrderId(pocOrderId))?.paymentStatus).toBe('PAID')
    expect(getLiveVariant(boot.slug, targetVariant.sku).reservedStock).toBe(0)
    expect(getLiveVariant(boot.slug, targetVariant.sku).stock).toBe(startStock - 1)

    // 2. Window expires without collection -> stock released automatically
    const pocExpireOrderId = 'ORD-POC-EXPIRE-1'
    const expireRun = await start(executeDurableCheckoutWorkflow, [
      {
        orderId: pocExpireOrderId,
        paymentOption: 'pay_on_collection',
        waitForFulfillment: true,
        timeouts: { payOnCollectionTimeout: '40ms' },
        customer: {
          name: 'Alex Rivera',
          email: 'alex.rivera@example.com',
          collectionLocation: 'Flagship Storefront ComposeIt — SoHo',
        },
        items: [
          {
            id: String(boot.id),
            slug: boot.slug,
            variantSku: targetVariant.sku,
            title: boot.title,
            brand: boot.brand,
            category: boot.category,
            subcategory: boot.subcategory,
            size: targetVariant.size,
            color: targetVariant.color,
            price: boot.price,
            quantity: 1,
          },
        ],
      },
    ])

    const expireOutcome = await expireRun.returnValue
    expect(expireOutcome.success).toBe(true)
    if (expireOutcome.success) {
      expect(expireOutcome.fulfillmentOutcome?.timedOut).toBe(true)
      expect(expireOutcome.fulfillmentOutcome?.stockReleased).toBe(true)
      expect(expireOutcome.fulfillmentOutcome?.finalStatus).toBe('CANCELLED')
    }
    expect((await getOrderByOrderId(pocExpireOrderId))?.orderStatus).toBe('CANCELLED')
    expect(getLiveVariant(boot.slug, targetVariant.sku).reservedStock).toBe(0)
    expect(getLiveVariant(boot.slug, targetVariant.sku).stock).toBe(startStock - 1)
  })

  it('handles pay_on_delivery (24h configurable window: delivery deducts stock, delivery failure & timeout release stock) + API PATCH', async () => {
    const products = collectionsStore.products as unknown as Product[]
    const boot = products.find((p) => p.slug === 'milan-leather-chelsea-boot')!
    const targetVariant = boot.variants![3]
    const startStock = targetVariant.stock

    // 1. Delivery succeeds via HTTP POST /api/checkout + PATCH /api/storefront/orders
    const podOrderId = 'ORD-POD-OK-1'
    const checkoutReq = new NextRequest('http://localhost:3000/api/checkout', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        orderId: podOrderId,
        userId: 'neon_usr_alex',
        paymentOption: 'pay_on_delivery',
        timeouts: { payOnDeliveryTimeout: '500ms' },
        customer: {
          name: 'Alex Rivera',
          email: 'alex.rivera@example.com',
          address: '742 Evergreen Terrace, San Francisco, CA',
        },
        items: [
          {
            id: String(boot.id),
            slug: boot.slug,
            variantSku: targetVariant.sku,
            title: boot.title,
            brand: boot.brand,
            category: boot.category,
            subcategory: boot.subcategory,
            size: targetVariant.size,
            color: targetVariant.color,
            price: boot.price,
            quantity: 1,
          },
        ],
      }),
    })

    const checkoutRes = await postCheckout(checkoutReq)
    expect(checkoutRes.status).toBe(200)
    const checkoutData = await checkoutRes.json()
    expect(checkoutData.order.orderId).toBe(podOrderId)
    expect(checkoutData.order.paymentSummary.status).toBe('PENDING')

    await waitForWorkflowHook(getOrderFulfillmentHookToken(podOrderId))
    expect(getLiveVariant(boot.slug, targetVariant.sku).reservedStock).toBe(1)

    const setMockSessionUser = (
      globalThis as unknown as {
        __setMockNeonSessionUser__: (
          user: { id: string; email: string; name: string; role?: string | null } | null,
        ) => void
      }
    ).__setMockNeonSessionUser__

    // Regular customer cannot advance fulfillment status or self-mark order delivered/paid
    const customerAdvanceRes = await patchOrderRoute(
      new NextRequest('http://localhost:3000/api/storefront/orders', {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          orderId: podOrderId,
          nextStatus: 'OUT_FOR_DELIVERY',
        }),
      }),
    )
    expect(customerAdvanceRes.status).toBe(403)

    // Authorized admin/fulfillment operator advances order to OUT_FOR_DELIVERY -> COMPLETED
    try {
      setMockSessionUser({
        id: 'neon_usr_admin',
        email: 'admin@storefront.example.com',
        name: 'Store Admin',
        role: 'admin',
      })

      const outReq = new NextRequest('http://localhost:3000/api/storefront/orders', {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          orderId: podOrderId,
          nextStatus: 'OUT_FOR_DELIVERY',
          note: 'Courier on route.',
        }),
      })
      const outRes = await patchOrderRoute(outReq)
      expect(outRes.status).toBe(200)
      const outData = await outRes.json()
      expect(outData.order.orderStatus).toBe('OUT_FOR_DELIVERY')

      const deliveredReq = new NextRequest('http://localhost:3000/api/storefront/orders', {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          orderId: podOrderId,
          nextStatus: 'COMPLETED',
          note: 'Paid on delivery & signed.',
        }),
      })
      const deliveredRes = await patchOrderRoute(deliveredReq)
      expect(deliveredRes.status).toBe(200)
      const deliveredData = await deliveredRes.json()
      expect(deliveredData.order.orderStatus).toBe('COMPLETED')
      expect(deliveredData.order.paymentStatus).toBe('PAID')
    } finally {
      setMockSessionUser({
        id: 'neon_usr_alex',
        email: 'alex.rivera@example.com',
        name: 'Alex Rivera',
        role: 'customer',
      })
    }
    expect(getLiveVariant(boot.slug, targetVariant.sku).reservedStock).toBe(0)
    expect(getLiveVariant(boot.slug, targetVariant.sku).stock).toBe(startStock - 1)

    // 2. Delivery fails -> stock released
    const failOrderId = 'ORD-POD-FAIL-1'
    const failRun = await start(executeDurableCheckoutWorkflow, [
      {
        orderId: failOrderId,
        paymentOption: 'pay_on_delivery',
        waitForFulfillment: true,
        timeouts: { payOnDeliveryTimeout: '400ms' },
        customer: {
          name: 'Alex Rivera',
          email: 'alex.rivera@example.com',
          address: '742 Evergreen Terrace, San Francisco, CA',
        },
        items: [
          {
            id: String(boot.id),
            slug: boot.slug,
            variantSku: targetVariant.sku,
            title: boot.title,
            brand: boot.brand,
            category: boot.category,
            subcategory: boot.subcategory,
            size: targetVariant.size,
            color: targetVariant.color,
            price: boot.price,
            quantity: 1,
          },
        ],
      },
    ])

    await waitForWorkflowHook(getOrderFulfillmentHookToken(failOrderId))
    expect(getLiveVariant(boot.slug, targetVariant.sku).reservedStock).toBe(1)

    await orderFulfillmentHook.resume(getOrderFulfillmentHookToken(failOrderId), {
      nextStatus: 'CANCELLED',
      deliveryFailed: true,
      note: 'Recipient unavailable after 3 courier attempts.',
    })
    const failOutcome = await failRun.returnValue
    expect(failOutcome.success).toBe(true)
    if (failOutcome.success) {
      expect(failOutcome.fulfillmentOutcome?.stockReleased).toBe(true)
      expect(failOutcome.fulfillmentOutcome?.finalStatus).toBe('CANCELLED')
    }
    expect(getLiveVariant(boot.slug, targetVariant.sku).reservedStock).toBe(0)
    expect(getLiveVariant(boot.slug, targetVariant.sku).stock).toBe(startStock - 1)

    // 3. 24h window expires -> stock released
    const expireOrderId = 'ORD-POD-EXPIRE-1'
    const expireRun = await start(executeDurableCheckoutWorkflow, [
      {
        orderId: expireOrderId,
        paymentOption: 'pay_on_delivery',
        waitForFulfillment: true,
        timeouts: { payOnDeliveryTimeout: '40ms' },
        customer: {
          name: 'Alex Rivera',
          email: 'alex.rivera@example.com',
          address: '742 Evergreen Terrace, San Francisco, CA',
        },
        items: [
          {
            id: String(boot.id),
            slug: boot.slug,
            variantSku: targetVariant.sku,
            title: boot.title,
            brand: boot.brand,
            category: boot.category,
            subcategory: boot.subcategory,
            size: targetVariant.size,
            color: targetVariant.color,
            price: boot.price,
            quantity: 1,
          },
        ],
      },
    ])

    const expireOutcome = await expireRun.returnValue
    expect(expireOutcome.success).toBe(true)
    if (expireOutcome.success) {
      expect(expireOutcome.fulfillmentOutcome?.timedOut).toBe(true)
      expect(expireOutcome.fulfillmentOutcome?.stockReleased).toBe(true)
    }
    expect(getLiveVariant(boot.slug, targetVariant.sku).reservedStock).toBe(0)
    expect(getLiveVariant(boot.slug, targetVariant.sku).stock).toBe(startStock - 1)
  })

  it('publishes clothing product reviews via Payload SDK and updates rating averages', async () => {
    const slug = 'organic-pima-crewneck-shirt'
    const created = await createProductReview({
      productSlug: slug,
      neonUserId: 'neon_usr_maya',
      authorName: 'Maya Lin',
      authorEmail: 'maya.lin@example.com',
      rating: 5,
      title: 'Exceptionally soft organic cotton',
      comment: 'Holds collar structure cleanly after wearing all day.',
      variantSize: 'M',
      variantColor: 'Crisp Ivory',
    })

    expect(created.review.title).toBe('Exceptionally soft organic cotton')
    expect(created.product.reviewCount).toBeGreaterThan(0)

    const detail = await fetchProductBySlugWithReviews(slug)
    expect(
      detail.reviews.some((r: Review) => r.title === 'Exceptionally soft organic cotton'),
    ).toBe(true)
  })

  it('syncs separate billing details, carts, and wishlists linked by neonUserId via Payload SDK', async () => {
    const neonUserId = 'neon_usr_sync_1'

    const initialBilling = await getBillingDetails(neonUserId)
    expect(initialBilling).toBeNull()

    const savedBilling = await upsertBillingDetails({
      neonUserId,
      phone: '+1 (415) 555-0192',
      shippingAddress: '742 Evergreen Terrace, Suite 200',
    })
    expect(savedBilling.neonUserId).toBe(neonUserId)
    expect(savedBilling.phone).toBe('+1 (415) 555-0192')
    expect(savedBilling.shippingAddress).toBe('742 Evergreen Terrace, Suite 200')

    const updatedBilling = await upsertBillingDetails({
      neonUserId,
      phone: '+1 (415) 555-9999',
      shippingAddress: '100 Market St, San Francisco, CA',
    })
    expect(updatedBilling.id).toBe(savedBilling.id)
    expect(updatedBilling.phone).toBe('+1 (415) 555-9999')

    const fetchedBilling = await getBillingDetails(neonUserId)
    expect(fetchedBilling?.shippingAddress).toBe('100 Market St, San Francisco, CA')

    const oxford = (collectionsStore.products as unknown as Product[]).find(
      (p) => p.slug === 'classic-oxford-button-down',
    )!
    const syncedCart = await syncCartWithPayload(neonUserId, [
      {
        product: oxford.id,
        productSlug: oxford.slug,
        cartItemId: 'PROD-1-SKY-M',
        variantSku: 'PROD-1-SKY-M',
        title: oxford.title,
        brand: oxford.brand,
        category: oxford.category,
        subcategory: oxford.subcategory,
        selectedSize: 'M',
        selectedColor: 'Oxford Sky',
        selectedColorHex: '#7FA3C9',
        unitPrice: oxford.price,
        price: oxford.price,
        quantity: 2,
        maxAvailableStock: 3,
        imageUrl: '/images/shirt.png',
      },
    ])
    expect(syncedCart.neonUserId).toBe(neonUserId)
    expect(syncedCart.items?.length).toBe(1)

    const fetchedCart = await getCartByNeonUserId(neonUserId)
    expect(fetchedCart?.items?.[0].variantSku).toBe('PROD-1-SKY-M')
    expect(fetchedCart?.items?.[0].quantity).toBe(2)

    const jacket = (collectionsStore.products as unknown as Product[]).find(
      (p) => p.slug === 'moto-full-grain-biker-jacket',
    )!
    const addedWishlist = await toggleWishlistItemInPayload(neonUserId, {
      id: jacket.id,
      slug: jacket.slug,
    })
    expect(addedWishlist.neonUserId).toBe(neonUserId)
    expect(addedWishlist.items?.some((i) => i.productSlug === jacket.slug)).toBe(true)

    const toggledOff = await toggleWishlistItemInPayload(neonUserId, {
      id: jacket.id,
      slug: jacket.slug,
    })
    expect(toggledOff.items?.length).toBe(0)

    const syncedWishlist = await syncWishlistWithPayload(neonUserId, [
      { product: oxford.id, productSlug: oxford.slug },
    ])
    expect(syncedWishlist.items?.length).toBe(1)
    const fetchedWishlist = await getWishlistByNeonUserId(neonUserId)
    expect(fetchedWishlist?.items?.[0].productSlug).toBe(oxford.slug)

    const userOrders = await getOrdersByUser({ neonUserId: 'neon_usr_alex' })
    expect(userOrders.length).toBeGreaterThan(0)
  })

  it('enforces server-side session checks on checkout and ownership rules across routes and collections', async () => {
    const setMockSessionUser = (
      globalThis as unknown as {
        __setMockNeonSessionUser__: (
          user: { id: string; email: string; name: string; role?: string | null } | null,
        ) => void
      }
    ).__setMockNeonSessionUser__

    const products = collectionsStore.products as unknown as Product[]
    const oxford = products.find((p) => p.slug === 'classic-oxford-button-down')!
    const targetVariant = oxford.variants!.find((v) => v.sku === 'PROD-1-SKY-M')!

    const buildCheckoutRequest = (body: Record<string, unknown>) =>
      new NextRequest('http://localhost:3000/api/checkout', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          paymentOption: 'pay_and_delivery',
          customer: {
            name: 'Alex Rivera',
            email: 'alex.rivera@example.com',
            address: '742 Evergreen Terrace, San Francisco, CA',
          },
          payment: {
            cardholderName: 'Alex Rivera',
            cardNumber: '4242424242424242',
            expiry: '08/29',
          },
          items: [
            {
              id: String(oxford.id),
              slug: oxford.slug,
              variantSku: targetVariant.sku,
              title: oxford.title,
              brand: oxford.brand,
              category: oxford.category,
              subcategory: oxford.subcategory,
              size: targetVariant.size,
              color: targetVariant.color,
              price: oxford.price,
              quantity: 1,
            },
          ],
          ...body,
        }),
      })

    try {
      // 1. Unauthenticated checkout must be rejected with 401
      setMockSessionUser(null)
      const unauthCheckoutRes = await postCheckout(
        buildCheckoutRequest({ orderId: 'ORD-UNAUTH-1' }),
      )
      expect(unauthCheckoutRes.status).toBe(401)

      // 2. Spoofed userId mismatched with session user must return 403
      setMockSessionUser({
        id: 'neon_usr_alex',
        email: 'alex.rivera@example.com',
        name: 'Alex Rivera',
        role: 'customer',
      })
      const spoofCheckoutRes = await postCheckout(
        buildCheckoutRequest({ orderId: 'ORD-SPOOF-1', userId: 'neon_usr_other' }),
      )
      expect(spoofCheckoutRes.status).toBe(403)

      // 3. Another user cannot mutate orders or read documents owned by neon_usr_alex
      setMockSessionUser({
        id: 'neon_usr_other',
        email: 'other.user@example.com',
        name: 'Other User',
        role: 'customer',
      })
      const forbiddenPatchRes = await patchOrderRoute(
        new NextRequest('http://localhost:3000/api/storefront/orders', {
          method: 'PATCH',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            orderId: 'ORD-PAD-1',
            nextStatus: 'CANCELLED',
          }),
        }),
      )
      expect(forbiddenPatchRes.status).toBe(403)

      const forbiddenDocRes = await patchOrderRoute(
        new NextRequest('http://localhost:3000/api/storefront/orders', {
          method: 'PATCH',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            action: 'generate_document',
            orderId: 'ORD-PAD-1',
            documentType: 'RECEIPT',
          }),
        }),
      )
      expect(forbiddenDocRes.status).toBe(403)

      // 4. Unauthenticated on-demand document & order access return 401
      setMockSessionUser(null)
      const unauthDocRes = await patchOrderRoute(
        new NextRequest('http://localhost:3000/api/storefront/orders', {
          method: 'PATCH',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            action: 'generate_document',
            orderId: 'ORD-PAD-1',
            documentType: 'RECEIPT',
          }),
        }),
      )
      expect(unauthDocRes.status).toBe(401)

      // 5. Actual owner can generate an on-demand receipt via ComposeIt (200)
      setMockSessionUser({
        id: 'neon_usr_alex',
        email: 'alex.rivera@example.com',
        name: 'Alex Rivera',
        role: 'customer',
      })
      const ownerDocRes = await patchOrderRoute(
        new NextRequest('http://localhost:3000/api/storefront/orders', {
          method: 'PATCH',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            action: 'generate_document',
            orderId: 'ORD-PAD-1',
            documentType: 'RECEIPT',
          }),
        }),
      )
      expect(ownerDocRes.status).toBe(200)
      const ownerDocData = await ownerDocRes.json()
      expect(ownerDocData.document.documentType).toBe('RECEIPT')
      expect(ownerDocData.document.pdfUrl).toContain('api.composeit.local/ephemeral')

      // 5b. Regular customer cannot spoof payment confirmation or mark their own order delivered/failed
      const customerPaymentRes = await patchOrderRoute(
        new NextRequest('http://localhost:3000/api/storefront/orders', {
          method: 'PATCH',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            action: 'payment',
            orderId: 'ORD-PAY-SEC-1',
            authorized: true,
          }),
        }),
      )
      expect(customerPaymentRes.status).toBe(403)

      const customerCompleteRes = await patchOrderRoute(
        new NextRequest('http://localhost:3000/api/storefront/orders', {
          method: 'PATCH',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            orderId: 'ORD-PAD-1',
            nextStatus: 'COMPLETED',
          }),
        }),
      )
      expect(customerCompleteRes.status).toBe(403)

      const customerDeliveryFailedRes = await patchOrderRoute(
        new NextRequest('http://localhost:3000/api/storefront/orders', {
          method: 'PATCH',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            orderId: 'ORD-PAD-1',
            deliveryFailed: true,
          }),
        }),
      )
      expect(customerDeliveryFailedRes.status).toBe(403)

      // 5c. Customer attempting to cancel an already COMPLETED order gets 409
      const customerCancelCompletedRes = await patchOrderRoute(
        new NextRequest('http://localhost:3000/api/storefront/orders', {
          method: 'PATCH',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            orderId: 'ORD-PAD-1',
            nextStatus: 'CANCELLED',
          }),
        }),
      )
      expect(customerCancelCompletedRes.status).toBe(409)

      // 6. Verify Payload collection access policies & ownership filters directly
      const customerReq = { user: null } as unknown as PayloadRequest
      expect(await ownerByNeonUserIdAccess.read({ req: customerReq })).toEqual({
        neonUserId: { equals: 'neon_usr_alex' },
      })
      expect(
        await ownerByNeonUserIdAccess.create({
          req: customerReq,
          data: { neonUserId: 'neon_usr_other' },
        }),
      ).toBe(false)
      expect(
        await ownerByNeonUserIdAccess.create({
          req: customerReq,
          data: { neonUserId: 'neon_usr_alex' },
        }),
      ).toBe(true)
      expect(
        await ownerByNeonUserIdAccess.update({
          req: customerReq,
          data: { neonUserId: 'neon_usr_other' },
        }),
      ).toBe(false)
      expect(await ordersAccess.read({ req: customerReq })).toEqual({
        or: [
          { neonUserId: { equals: 'neon_usr_alex' } },
          { customerEmail: { equals: 'alex.rivera@example.com' } },
        ],
      })
      expect(await ordersAccess.create({ req: customerReq, data: {} })).toBe(false)
      expect(await reviewsAccess.read({ req: customerReq })).toBe(true)
      expect(
        await reviewsAccess.create({
          req: customerReq,
          data: { neonUserId: 'neon_usr_other' },
        }),
      ).toBe(false)
      expect(await isAdminAccess({ req: customerReq })).toBe(false)

      // Unauthenticated request denied for private collections
      setMockSessionUser(null)
      expect(await ownerByNeonUserIdAccess.read({ req: customerReq })).toBe(false)
      expect(await ownerByNeonUserIdAccess.create({ req: customerReq, data: {} })).toBe(false)
      expect(await ordersAccess.read({ req: customerReq })).toBe(false)
      expect(await reviewsAccess.create({ req: customerReq, data: {} })).toBe(false)
    } finally {
      setMockSessionUser({
        id: 'neon_usr_alex',
        email: 'alex.rivera@example.com',
        name: 'Alex Rivera',
        role: 'customer',
      })
    }
  })
})
