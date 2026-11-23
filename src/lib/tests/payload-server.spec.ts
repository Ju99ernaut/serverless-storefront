import { describe, it, expect, vi, beforeEach } from 'vitest'
import { getPayload } from 'payload'
import {
  parseWorkflowDurationMs,
  getOrderByOrderIdServer,
  createOrderServer,
  updateOrderServer,
  reserveVariantStock,
  releaseVariantStock,
  commitVariantStock,
  clearUserCartServer,
} from '../payload-server'
import type { Order, Product } from '@/payload-types'

const mockFind = vi.fn()
const mockCreate = vi.fn()
const mockUpdate = vi.fn()

vi.mock('payload', () => ({
  getPayload: vi.fn(async () => ({
    find: mockFind,
    create: mockCreate,
    update: mockUpdate,
  })),
}))

describe('src/lib/payload-server unit tests', () => {
  beforeEach(() => {
    vi.clearAllMocks()
  })

  describe('parseWorkflowDurationMs', () => {
    it('returns positive number durations directly', () => {
      expect(parseWorkflowDurationMs(5000, 1000)).toBe(5000)
      expect(parseWorkflowDurationMs(1, 1000)).toBe(1)
    })

    it('parses valid string units correctly', () => {
      expect(parseWorkflowDurationMs('500ms', 1000)).toBe(500)
      expect(parseWorkflowDurationMs('2s', 1000)).toBe(2000)
      expect(parseWorkflowDurationMs('30m', 1000)).toBe(30 * 60 * 1000)
      expect(parseWorkflowDurationMs('8h', 1000)).toBe(8 * 60 * 60 * 1000)
      expect(parseWorkflowDurationMs('24h', 1000)).toBe(24 * 60 * 60 * 1000)
      expect(parseWorkflowDurationMs('2d', 1000)).toBe(2 * 24 * 60 * 60 * 1000)
    })

    it('returns fallback for invalid or empty duration inputs', () => {
      expect(parseWorkflowDurationMs(undefined, 60000)).toBe(60000)
      expect(parseWorkflowDurationMs('', 60000)).toBe(60000)
      expect(parseWorkflowDurationMs('invalid', 60000)).toBe(60000)
      expect(parseWorkflowDurationMs(-100, 60000)).toBe(60000)
    })
  })

  describe('getOrderByOrderIdServer, createOrderServer, updateOrderServer', () => {
    it('queries order by orderId via getServerPayload', async () => {
      const mockOrder = { id: 1, orderId: 'ORD-999', orderStatus: 'CONFIRMED' }
      mockFind.mockResolvedValueOnce({ docs: [mockOrder] })

      const result = await getOrderByOrderIdServer('ORD-999')
      expect(mockFind).toHaveBeenCalledWith({
        collection: 'orders',
        where: { orderId: { equals: 'ORD-999' } },
        limit: 1,
      })
      expect(result).toEqual(mockOrder)
    })

    it('returns null if orderId is empty or find fails', async () => {
      expect(await getOrderByOrderIdServer('')).toBe(null)

      mockFind.mockRejectedValueOnce(new Error('DB read error'))
      expect(await getOrderByOrderIdServer('NON-EXISTENT')).toBe(null)
    })

    it('creates order via payload.create', async () => {
      const mockCreated = { id: 2, orderId: 'ORD-NEW' }
      mockCreate.mockResolvedValueOnce(mockCreated)

      const result = await createOrderServer({ orderId: 'ORD-NEW' } as never)
      expect(mockCreate).toHaveBeenCalledWith({
        collection: 'orders',
        data: { orderId: 'ORD-NEW' },
      })
      expect(result).toEqual(mockCreated)
    })

    it('updates order via payload.update', async () => {
      const mockUpdated = { id: 2, orderId: 'ORD-NEW', orderStatus: 'PROCESSING' }
      mockUpdate.mockResolvedValueOnce(mockUpdated)

      const result = await updateOrderServer(2, { orderStatus: 'PROCESSING' } as never)
      expect(mockUpdate).toHaveBeenCalledWith({
        collection: 'orders',
        id: 2,
        data: { orderStatus: 'PROCESSING' },
      })
      expect(result).toEqual(mockUpdated)
    })
  })

  describe('clearUserCartServer', () => {
    it('empties user cart items', async () => {
      mockFind.mockResolvedValueOnce({
        docs: [{ id: 55, neonUserId: 'usr_abc', items: [{ id: 'item1' }] }],
      })
      mockUpdate.mockResolvedValueOnce({ id: 55, items: [] })

      await clearUserCartServer('usr_abc')
      expect(mockFind).toHaveBeenCalledWith({
        collection: 'carts',
        where: { neonUserId: { equals: 'usr_abc' } },
        limit: 1,
      })
      expect(mockUpdate).toHaveBeenCalledWith({
        collection: 'carts',
        id: 55,
        data: { items: [] },
      })
    })
  })

  describe('inventory management: reserveVariantStock', () => {
    it('fails to reserve if requested variant stock is insufficient', async () => {
      const mockProduct = {
        id: 10,
        slug: 'linen-shirt',
        title: 'Linen Shirt',
        category: 'shirts',
        variants: [
          {
            sku: 'LINEN-M',
            size: 'M',
            color: 'White',
            colorHex: '#ffffff',
            lowStockThreshold: 5,
            stock: 2,
            reservedStock: 2,
          },
        ],
        createdAt: '',
        updatedAt: '',
      } as unknown as Product

      mockFind.mockImplementation((args: { collection: string }) => {
        if (args.collection === 'products') {
          return Promise.resolve({ docs: [mockProduct] })
        }
        return Promise.resolve({ docs: [] })
      })

      const result = await reserveVariantStock({
        orderId: 'ORD-OUT-OF-STOCK',
        reservationKey: 'res_out_of_stock',
        items: [{ productSlug: 'linen-shirt', variantSku: 'LINEN-M', quantity: 1 }],
      })

      expect(result.success).toBe(false)
      expect(result.error).toContain('Insufficient stock')
    })
  })
})
