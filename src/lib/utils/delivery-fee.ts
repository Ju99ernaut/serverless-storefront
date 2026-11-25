// lib/delivery-fee.ts

export interface Coordinates {
  lat: number
  lng: number
}

export interface DeliveryRateConfig {
  storeLocation: Coordinates
  baseFee: number // e.g. 2.00
  ratePerKm: number // e.g. 0.75
  includedRadiusKm?: number // e.g. 2 (first 2 km covered by baseFee)
  freeThreshold: number // e.g. 50 (subtotal >= 50 => free delivery)
  maxFreeDistanceKm?: number // optional cap on free delivery distance
  maxDeliveryRadiusKm?: number
  roundTo?: number // e.g. 0.5 or 1 (0.01 for exact cents)
}

export interface DeliveryFeeResult {
  deliverable: boolean
  distanceKm: number
  fee: number
  isFreeDelivery: boolean
  amountNeededForFreeDelivery: number
  reason?: 'OUT_OF_RANGE' | 'MISSING_LOCATION'
}

export function calculateHaversineKm(a: Coordinates, b: Coordinates): number {
  const R = 6371 // Earth radius in km
  const toRad = (deg: number) => (deg * Math.PI) / 180

  const dLat = toRad(b.lat - a.lat)
  const dLng = toRad(b.lng - a.lng)

  const lat1 = toRad(a.lat)
  const lat2 = toRad(b.lat)

  const h = Math.sin(dLat / 2) ** 2 + Math.cos(lat1) * Math.cos(lat2) * Math.sin(dLng / 2) ** 2

  return 2 * R * Math.asin(Math.sqrt(h))
}

function roundFee(amount: number, step = 0.01): number {
  if (amount <= 0) return 0
  const rounded = Math.round(amount / step) * step
  return Number(rounded.toFixed(2))
}

export function calculateDeliveryFee(params: {
  subtotal: number
  customerLocation: Coordinates | null
  config: DeliveryRateConfig
  overrideDistanceKm?: number // pass road distance here if using a routing API
}): DeliveryFeeResult {
  const { subtotal, customerLocation, config, overrideDistanceKm } = params

  if (!customerLocation) {
    return {
      deliverable: false,
      distanceKm: 0,
      fee: 0,
      isFreeDelivery: false,
      amountNeededForFreeDelivery: Math.max(0, config.freeThreshold - subtotal),
      reason: 'MISSING_LOCATION',
    }
  }

  const rawKm = overrideDistanceKm ?? calculateHaversineKm(config.storeLocation, customerLocation)
  const distanceKm = Number(rawKm.toFixed(2))

  if (config.maxDeliveryRadiusKm && distanceKm > config.maxDeliveryRadiusKm) {
    return {
      deliverable: false,
      distanceKm,
      fee: 0,
      isFreeDelivery: false,
      amountNeededForFreeDelivery: Math.max(0, config.freeThreshold - subtotal),
      reason: 'OUT_OF_RANGE',
    }
  }

  const meetsSubtotalThreshold = config.freeThreshold > 0 && subtotal >= config.freeThreshold
  const meetsDistanceCap =
    config.maxFreeDistanceKm === undefined || distanceKm <= config.maxFreeDistanceKm

  if (meetsSubtotalThreshold && meetsDistanceCap) {
    return {
      deliverable: true,
      distanceKm,
      fee: 0,
      isFreeDelivery: true,
      amountNeededForFreeDelivery: 0,
    }
  }

  const billableKm = Math.max(0, distanceKm - (config.includedRadiusKm ?? 0))
  const computedFee = roundFee(
    config.baseFee + billableKm * config.ratePerKm,
    config.roundTo ?? 0.01,
  )

  return {
    deliverable: true,
    distanceKm,
    fee: computedFee,
    isFreeDelivery: false,
    amountNeededForFreeDelivery:
      config.freeThreshold > 0
        ? Math.max(0, Number((config.freeThreshold - subtotal).toFixed(2)))
        : 0,
  }
}
