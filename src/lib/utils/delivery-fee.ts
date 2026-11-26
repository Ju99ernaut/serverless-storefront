import { parseCollectionLocations, parseLocation } from './parse-locations'

export interface Coordinates {
  lat: number
  lng: number
}

export interface LocationValue extends Coordinates {
  address: string
}

export interface DeliveryFeeResult {
  deliverable: boolean
  distanceKm: number
  feeCents: number
  isFreeDelivery: boolean
  amountNeededForFreeDeliveryCents: number
  reason?: 'OUT OF RANGE' | 'MISSING LOCATION'
}

const R = 6371 // Earth radius in km
const BASE_FEE_CENTS = process.env.NEXT_PUBLIC_MIN_DELIVERY_FEE
  ? Number(process.env.NEXT_PUBLIC_MIN_DELIVERY_FEE)
  : 0
const RATE_PER_KM_CENTS = process.env.NEXT_PUBLIC_DELIVERY_RATE
  ? Number(process.env.NEXT_PUBLIC_DELIVERY_RATE)
  : 0
const FREE_THRESHOLD_CENTS = process.env.NEXT_PUBLIC_FREE_DELIVERY_THRESHOLD
  ? Number(process.env.NEXT_PUBLIC_FREE_DELIVERY_THRESHOLD)
  : 0
export const MAX_DELIVERY_RADIUS = process.env.NEXT_PUBLIC_MAX_DELIVERY_RADIUS
  ? Number(process.env.NEXT_PUBLIC_MAX_DELIVERY_RADIUS)
  : 0
const STORE_LOCATIONS = parseCollectionLocations(process.env.NEXT_PUBLIC_COLLECTION_LOCATIONS || '')

const toRad = (deg: number) => (deg * Math.PI) / 180

export function calculateHaversineKm(a: Coordinates, b: Coordinates): number {
  const dLat = toRad(b.lat - a.lat)
  const dLng = toRad(b.lng - a.lng)

  const lat1 = toRad(a.lat)
  const lat2 = toRad(b.lat)

  const h = Math.sin(dLat / 2) ** 2 + Math.cos(lat1) * Math.cos(lat2) * Math.sin(dLng / 2) ** 2

  return 2 * R * Math.asin(Math.sqrt(h))
}

export function findNearestLocation(origin: Coordinates) {
  if (STORE_LOCATIONS.length === 0) {
    return 0
  }

  let shortestKm = calculateHaversineKm(origin, STORE_LOCATIONS[0])

  for (let i = 1; i < STORE_LOCATIONS.length; i++) {
    const candidate = STORE_LOCATIONS[i]
    const km = calculateHaversineKm(origin, candidate)

    if (km < shortestKm) {
      shortestKm = km
    }
  }

  return shortestKm
}

export function calculateDeliveryFee(params: {
  items: Array<{ unitPriceCents: number; quantity: number }>
  customerAddress: string | null
}): DeliveryFeeResult {
  const { items, customerAddress } = params
  const subTotalCents = items.reduce((sum, item) => {
    const unitCents = Math.round(Number(item.unitPriceCents) || 0)
    const qty = Math.max(1, Math.round(Number(item.quantity) || 1))
    return sum + unitCents * qty
  }, 0)

  if (!customerAddress) {
    return {
      deliverable: false,
      distanceKm: 0,
      feeCents: 0,
      isFreeDelivery: false,
      amountNeededForFreeDeliveryCents: Math.max(0, FREE_THRESHOLD_CENTS - subTotalCents),
      reason: 'MISSING LOCATION',
    }
  }

  const customerLocation = parseLocation(customerAddress)
  const rawKm = findNearestLocation(customerLocation)
  const distanceKm = Number(rawKm.toFixed(2))

  if (MAX_DELIVERY_RADIUS && distanceKm > MAX_DELIVERY_RADIUS) {
    return {
      deliverable: false,
      distanceKm,
      feeCents: 0,
      isFreeDelivery: false,
      amountNeededForFreeDeliveryCents: Math.max(0, FREE_THRESHOLD_CENTS - subTotalCents),
      reason: 'OUT OF RANGE',
    }
  }

  const meetsSubtotalThreshold = FREE_THRESHOLD_CENTS > 0 && subTotalCents >= FREE_THRESHOLD_CENTS

  if (meetsSubtotalThreshold) {
    return {
      deliverable: true,
      distanceKm,
      feeCents: 0,
      isFreeDelivery: true,
      amountNeededForFreeDeliveryCents: 0,
    }
  }

  const billableKm = Math.max(0, distanceKm)
  const computedFeeCents = Math.max(BASE_FEE_CENTS, billableKm * RATE_PER_KM_CENTS)

  return {
    deliverable: true,
    distanceKm,
    feeCents: computedFeeCents,
    isFreeDelivery: false,
    amountNeededForFreeDeliveryCents:
      FREE_THRESHOLD_CENTS > 0 ? Math.max(0, FREE_THRESHOLD_CENTS - subTotalCents) : 0,
  }
}
