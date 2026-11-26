import type { LocationValue } from './delivery-fee'

export function parseLocation(raw = '') {
  const trimmed = raw.trim()

  const [namePart, coordsPart] = trimmed.split('@')
  const [latStr, lngStr] = (coordsPart ?? '').split(',')
  return {
    address: namePart.trim(),
    lat: Number(latStr),
    lng: Number(lngStr),
  }
}

export function parseCollectionLocations(raw = ''): LocationValue[] {
  return raw
    .split('|')
    .map((entry) => entry.trim())
    .filter(Boolean)
    .map((entry) => {
      const [namePart, coordsPart] = entry.split('@')
      const [latStr, lngStr] = (coordsPart ?? '').split(',')
      return {
        address: namePart.trim(),
        lat: Number(latStr),
        lng: Number(lngStr),
      }
    })
    .filter((loc) => loc.address && !Number.isNaN(loc.lat) && !Number.isNaN(loc.lng))
}
