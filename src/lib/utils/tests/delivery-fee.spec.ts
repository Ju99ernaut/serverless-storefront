import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'

const ORIGINAL_ENV = { ...process.env }

function setDeliveryEnv(overrides: Record<string, string | undefined>) {
  process.env = {
    ...ORIGINAL_ENV,
    NEXT_PUBLIC_MIN_DELIVERY_FEE: '500',
    NEXT_PUBLIC_DELIVERY_RATE: '100',
    NEXT_PUBLIC_FREE_DELIVERY_THRESHOLD: '5000',
    NEXT_PUBLIC_MAX_DELIVERY_RADIUS: '25',
    NEXT_PUBLIC_COLLECTION_LOCATIONS: 'Downtown@-17.8292,31.0522|Avondale@-17.8015,31.0378',
    ...overrides,
  }
}

async function loadDeliveryModule(overrides: Record<string, string | undefined> = {}) {
  vi.resetModules()
  setDeliveryEnv(overrides)
  return import('../delivery-fee')
}

describe('src/lib/utils/delivery-fee unit tests', () => {
  beforeEach(() => {
    vi.clearAllMocks()
  })

  afterEach(() => {
    process.env = { ...ORIGINAL_ENV }
    vi.restoreAllMocks()
  })

  describe('calculateHaversineKm', () => {
    it('returns 0 for identical coordinates', async () => {
      const { calculateHaversineKm } = await loadDeliveryModule()
      const point = { lat: -17.8252, lng: 31.0335 }

      expect(calculateHaversineKm(point, point)).toBe(0)
    })

    it('calculates expected distance between two points in km', async () => {
      const { calculateHaversineKm } = await loadDeliveryModule()
      const downtown = { lat: -17.8292, lng: 31.0522 }
      const avondale = { lat: -17.8015, lng: 31.0378 }

      const km = calculateHaversineKm(downtown, avondale)
      expect(km).toBeGreaterThan(3.1)
      expect(km).toBeLessThan(3.5)
    })
  })

  describe('findNearestLocation', () => {
    it('returns 0 when no store locations are configured', async () => {
      const { findNearestLocation } = await loadDeliveryModule({
        NEXT_PUBLIC_COLLECTION_LOCATIONS: '',
      })

      expect(findNearestLocation({ lat: -17.81, lng: 31.04 })).toBe(0)
    })

    it('returns the shortest distance among configured store locations', async () => {
      const { findNearestLocation, calculateHaversineKm } = await loadDeliveryModule({
        NEXT_PUBLIC_COLLECTION_LOCATIONS: 'FarSouth@-17.9000,31.0500|NearEast@-17.8250,31.0500',
      })

      const origin = { lat: -17.82, lng: 31.045 }
      const expectedNear = calculateHaversineKm(origin, { lat: -17.825, lng: 31.05 })

      expect(findNearestLocation(origin)).toBeCloseTo(expectedNear, 6)
    })
  })

  describe('calculateDeliveryFee', () => {
    it('returns MISSING LOCATION when customerAddress is null', async () => {
      const { calculateDeliveryFee } = await loadDeliveryModule({
        NEXT_PUBLIC_FREE_DELIVERY_THRESHOLD: '4000',
      })

      const result = calculateDeliveryFee({
        items: [{ unitPriceCents: 1500, quantity: 1 }],
        customerAddress: null,
      })

      expect(result).toEqual({
        deliverable: false,
        distanceKm: 0,
        feeCents: 0,
        isFreeDelivery: false,
        amountNeededForFreeDeliveryCents: 2500,
        reason: 'MISSING LOCATION',
      })
    })

    it('returns OUT OF RANGE when distance exceeds MAX_DELIVERY_RADIUS', async () => {
      const { calculateDeliveryFee } = await loadDeliveryModule({
        NEXT_PUBLIC_MAX_DELIVERY_RADIUS: '2',
        NEXT_PUBLIC_COLLECTION_LOCATIONS: 'Downtown@-17.8292,31.0522',
      })

      const result = calculateDeliveryFee({
        items: [{ unitPriceCents: 2000, quantity: 1 }],
        customerAddress: 'Borrowdale@-17.7568,31.0842',
      })

      expect(result.deliverable).toBe(false)
      expect(result.reason).toBe('OUT OF RANGE')
      expect(result.feeCents).toBe(0)
      expect(result.distanceKm).toBeGreaterThan(2)
    })

    it('grants free delivery when subtotal meets or exceeds FREE_THRESHOLD_CENTS', async () => {
      const { calculateDeliveryFee } = await loadDeliveryModule({
        NEXT_PUBLIC_FREE_DELIVERY_THRESHOLD: '5000',
        NEXT_PUBLIC_COLLECTION_LOCATIONS: 'Downtown@-17.8292,31.0522',
      })

      const result = calculateDeliveryFee({
        items: [
          { unitPriceCents: 2500, quantity: 1 },
          { unitPriceCents: 1250, quantity: 2 },
        ],
        customerAddress: 'Avondale@-17.8015,31.0378',
      })

      expect(result.deliverable).toBe(true)
      expect(result.isFreeDelivery).toBe(true)
      expect(result.feeCents).toBe(0)
      expect(result.amountNeededForFreeDeliveryCents).toBe(0)
    })

    it('enforces BASE_FEE_CENTS as a minimum fee when rate * distance is lower', async () => {
      const { calculateDeliveryFee } = await loadDeliveryModule({
        NEXT_PUBLIC_MIN_DELIVERY_FEE: '1000',
        NEXT_PUBLIC_DELIVERY_RATE: '50',
        NEXT_PUBLIC_FREE_DELIVERY_THRESHOLD: '10000',
        NEXT_PUBLIC_COLLECTION_LOCATIONS: 'Downtown@-17.8292,31.0522',
      })

      // Very close point -> distance ~0.11 km -> 0.11 * 50 = 5.5 < 1000 base fee
      const result = calculateDeliveryFee({
        items: [{ unitPriceCents: 2000, quantity: 1 }],
        customerAddress: 'Nearby@-17.8285,31.0515',
      })

      expect(result.deliverable).toBe(true)
      expect(result.isFreeDelivery).toBe(false)
      expect(result.feeCents).toBe(1000)
      expect(result.amountNeededForFreeDeliveryCents).toBe(8000)
    })

    it('calculates fee by distanceKm * RATE_PER_KM_CENTS when above BASE_FEE_CENTS', async () => {
      const { calculateDeliveryFee } = await loadDeliveryModule({
        NEXT_PUBLIC_MIN_DELIVERY_FEE: '200',
        NEXT_PUBLIC_DELIVERY_RATE: '500',
        NEXT_PUBLIC_FREE_DELIVERY_THRESHOLD: '10000',
        NEXT_PUBLIC_MAX_DELIVERY_RADIUS: '50',
        NEXT_PUBLIC_COLLECTION_LOCATIONS: 'Downtown@-17.8292,31.0522',
      })

      const customerAddress = 'Avondale@-17.8015,31.0378'
      const result = calculateDeliveryFee({
        items: [{ unitPriceCents: 3000, quantity: 1 }],
        customerAddress,
      })

      expect(result.deliverable).toBe(true)
      expect(result.isFreeDelivery).toBe(false)
      expect(result.feeCents).toBeCloseTo(result.distanceKm * 500, 4)
      expect(result.feeCents).toBeGreaterThan(200)
    })

    it('normalizes invalid or non-positive item quantities to 1', async () => {
      const { calculateDeliveryFee } = await loadDeliveryModule({
        NEXT_PUBLIC_FREE_DELIVERY_THRESHOLD: '2000',
        NEXT_PUBLIC_COLLECTION_LOCATIONS: 'Downtown@-17.8292,31.0522',
      })

      const result = calculateDeliveryFee({
        items: [{ unitPriceCents: 2000, quantity: 0 }],
        customerAddress: 'Avondale@-17.8015,31.0378',
      })

      expect(result.isFreeDelivery).toBe(true)
      expect(result.feeCents).toBe(0)
    })
  })
})
