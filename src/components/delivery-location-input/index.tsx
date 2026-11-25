'use client'

import { useState } from 'react'
import { LocateFixed, MapPin } from 'lucide-react'
import { Button } from '@/components/ui/button'
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import type { Coordinates } from '@/lib/utils/delivery-fee'

export interface DeliveryLocationValue extends Coordinates {
  address: string
}

interface DeliveryLocationInputProps {
  value: DeliveryLocationValue | null
  onChange: (next: DeliveryLocationValue) => void
  renderMap?: (props: {
    coords: Coordinates
    onSelectCoords: (coords: Coordinates) => void
  }) => React.ReactNode
}

const DEFAULT_CENTER: Coordinates = { lat: -17.8252, lng: 31.0335 }

export function DeliveryLocationInput({ value, onChange, renderMap }: DeliveryLocationInputProps) {
  const [locating, setLocating] = useState(false)
  const [geoError, setGeoError] = useState<string | null>(null)

  const currentLat = value?.lat ?? DEFAULT_CENTER.lat
  const currentLng = value?.lng ?? DEFAULT_CENTER.lng
  const currentAddress = value?.address ?? ''

  const handleUseCurrentLocation = () => {
    if (!navigator.geolocation) {
      setGeoError('Geolocation is not supported by this browser.')
      return
    }

    setLocating(true)
    setGeoError(null)

    navigator.geolocation.getCurrentPosition(
      (pos) => {
        const lat = Number(pos.coords.latitude.toFixed(6))
        const lng = Number(pos.coords.longitude.toFixed(6))
        onChange({
          address: currentAddress || `${lat}, ${lng}`,
          lat,
          lng,
        })
        setLocating(false)
      },
      (err) => {
        setGeoError(err.message || 'Unable to retrieve your location.')
        setLocating(false)
      },
      { enableHighAccuracy: true, timeout: 10000 },
    )
  }

  const handleCoordChange = (axis: 'lat' | 'lng', raw: string) => {
    const parsed = Number(raw)
    if (Number.isNaN(parsed)) return

    onChange({
      address: currentAddress,
      lat: axis === 'lat' ? parsed : currentLat,
      lng: axis === 'lng' ? parsed : currentLng,
    })
  }

  return (
    <Card>
      <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-3">
        <CardTitle className="flex items-center gap-2 text-base font-medium">
          <MapPin className="h-4 w-4" />
          Delivery Location
        </CardTitle>
        <Button
          type="button"
          variant="outline"
          size="sm"
          onClick={handleUseCurrentLocation}
          disabled={locating}
        >
          <LocateFixed className="mr-2 h-4 w-4" />
          {locating ? 'Locating...' : 'Use my location'}
        </Button>
      </CardHeader>

      <CardContent className="space-y-4">
        <div className="space-y-1.5">
          <Label htmlFor="delivery-address">Street / Area Address</Label>
          <Input
            id="delivery-address"
            placeholder="e.g. 42 Samora Machel Ave, Harare"
            value={currentAddress}
            onChange={(e) =>
              onChange({
                address: e.target.value,
                lat: currentLat,
                lng: currentLng,
              })
            }
          />
        </div>

        <div className="grid grid-cols-2 gap-3">
          <div className="space-y-1.5">
            <Label htmlFor="delivery-lat">Latitude</Label>
            <Input
              id="delivery-lat"
              type="number"
              step="any"
              value={currentLat}
              onChange={(e) => handleCoordChange('lat', e.target.value)}
            />
          </div>
          <div className="space-y-1.5">
            <Label htmlFor="delivery-lng">Longitude</Label>
            <Input
              id="delivery-lng"
              type="number"
              step="any"
              value={currentLng}
              onChange={(e) => handleCoordChange('lng', e.target.value)}
            />
          </div>
        </div>

        {geoError && <p className="text-sm text-destructive">{geoError}</p>}

        {renderMap && (
          <div className="overflow-hidden rounded-md border">
            {renderMap({
              coords: { lat: currentLat, lng: currentLng },
              onSelectCoords: (coords) =>
                onChange({
                  address: currentAddress,
                  lat: Number(coords.lat.toFixed(6)),
                  lng: Number(coords.lng.toFixed(6)),
                }),
            })}
          </div>
        )}
      </CardContent>
    </Card>
  )
}
