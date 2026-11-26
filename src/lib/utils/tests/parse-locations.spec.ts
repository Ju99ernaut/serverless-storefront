import { describe, expect, it } from 'vitest'
import { parseCollectionLocations, parseLocation } from '../parse-locations'

describe('src/lib/utils/parse-locations unit tests', () => {
  it('parses a valid "address@lat,lng" string and trims whitespace', () => {
    const result = parseLocation('  Avondale Pickup Point @ -17.8015 , 31.0378  ')

    expect(result).toEqual({
      address: 'Avondale Pickup Point',
      lat: -17.8015,
      lng: 31.0378,
    })
  })

  it('returns NaN coordinates when "@" or coordinates are missing', () => {
    expect(parseLocation('Shop yedu iri mutown')).toEqual({
      address: 'Shop yedu iri mutown',
      lat: 0,
      lng: Number.NaN,
    })

    expect(parseLocation('Shop yedu@-17.8292')).toEqual({
      address: 'Shop yedu',
      lat: -17.8292,
      lng: Number.NaN,
    })
  })

  it('returns empty address and NaN coordinates when given empty or default input', () => {
    expect(parseLocation()).toEqual({
      address: '',
      lat: 0,
      lng: Number.NaN,
    })

    expect(parseLocation('   ')).toEqual({
      address: '',
      lat: 0,
      lng: Number.NaN,
    })
  })

  it('converts blank longitude string to 0 via Number("")', () => {
    // Note: Number('') evaluates to 0 in JavaScript
    expect(parseLocation('Place@-17.8292,')).toEqual({
      address: 'Place',
      lat: -17.8292,
      lng: 0,
    })
  })
})

describe('parseCollectionLocations', () => {
  it('parses multiple pipe-delimited locations into LocationValue objects', () => {
    const raw =
      'Downtown@-17.8292,31.0522 | Avondale Pickup Point@-17.8015,31.0378 | Borrowdale@-17.7568,31.0842'

    expect(parseCollectionLocations(raw)).toEqual([
      { address: 'Downtown', lat: -17.8292, lng: 31.0522 },
      { address: 'Avondale Pickup Point', lat: -17.8015, lng: 31.0378 },
      { address: 'Borrowdale', lat: -17.7568, lng: 31.0842 },
    ])
  })

  it('filters out malformed entries with NaN coordinates or missing address', () => {
    const raw =
      'Valid Spot@-17.82,31.05 | Missing Coords | @-17.81,31.04 | Bad Lat@not-a-num,31.04 | || Another Valid@-17.79,31.06'

    expect(parseCollectionLocations(raw)).toEqual([
      { address: 'Valid Spot', lat: -17.82, lng: 31.05 },
      { address: 'Another Valid', lat: -17.79, lng: 31.06 },
    ])
  })

  it('returns an empty array for empty or undefined input', () => {
    expect(parseCollectionLocations()).toEqual([])
    expect(parseCollectionLocations('')).toEqual([])
    expect(parseCollectionLocations('   |   ')).toEqual([])
  })
})
