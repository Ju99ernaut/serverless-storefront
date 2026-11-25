export interface CollectionLocation {
  name: string
  lat: number
  lng: number
}

export function parseCollectionLocations(raw = ''): CollectionLocation[] {
  return raw
    .split('|')
    .map((entry) => entry.trim())
    .filter(Boolean)
    .map((entry) => {
      const [namePart, coordsPart] = entry.split('@')
      const [latStr, lngStr] = (coordsPart ?? '').split(',')
      return {
        name: namePart.trim(),
        lat: Number(latStr),
        lng: Number(lngStr),
      }
    })
    .filter((loc) => loc.name && !Number.isNaN(loc.lat) && !Number.isNaN(loc.lng))
}
