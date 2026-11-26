'use client'

import { useState } from 'react'
import { Loader2, LocateFixed } from 'lucide-react'
import { Button } from '@/components/ui/button'
import { Card, CardContent } from '@/components/ui/card'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import type { Coordinates } from '@/lib/utils/delivery-fee'
import { Textarea } from '../ui/textarea'
import { parseLocation } from '@/lib/utils/parse-locations'

interface DeliveryLocationInputProps {
  value: string | null
  onChange: (next: string) => void
  renderMap?: (props: {
    coords: Coordinates
    onSelectCoords: (coords: Coordinates) => void
  }) => React.ReactNode
}

const DEFAULT_CENTER: Coordinates = { lat: -17.8252, lng: 31.0335 }

export function DeliveryLocationInput({ value, onChange, renderMap }: DeliveryLocationInputProps) {
  const [locating, setLocating] = useState(false)
  const [geoError, setGeoError] = useState<string | null>(null)

  const parsedValue = parseLocation(value || '')
  const currentLat = parsedValue?.lat || DEFAULT_CENTER.lat
  const currentLng = parsedValue?.lng || DEFAULT_CENTER.lng
  const currentAddress = parsedValue?.address ?? ''

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
        onChange(`${currentAddress}@${lat},${lng}`)
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

    onChange(
      `${currentAddress}@${axis === 'lat' ? parsed : currentLat},${axis === 'lng' ? parsed : currentLng}`,
    )
  }

  return (
    <Card>
      <CardContent className="space-y-4">
        <div className="space-y-1.5">
          <Label htmlFor="delivery-address">Street / Area Address</Label>
          <Textarea
            id="delivery-address"
            name="address"
            placeholder="e.g. 42 Samora Machel Ave, Harare"
            autoComplete="shipping street-address"
            required
            rows={2}
            maxLength={300}
            value={currentAddress}
            onChange={(e) => onChange(`${e.target.value}@${currentLat},${currentLng}`)}
          />
        </div>

        <div className="grid grid-cols-2 gap-3">
          <div className="space-y-1.5">
            <Label htmlFor="delivery-lat">Latitude</Label>
            <Input
              id="delivery-lat"
              type="number"
              step="any"
              required
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
              required
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
                onChange(
                  `${currentAddress}@${Number(coords.lat.toFixed(6))},${Number(coords.lng.toFixed(6))}`,
                ),
            })}
          </div>
        )}

        <Button
          type="button"
          variant="outline"
          size="sm"
          onClick={handleUseCurrentLocation}
          disabled={locating}
          className="w-full"
        >
          {locating ? (
            <Loader2 className="h-4 w-4 animate-spin" />
          ) : (
            <LocateFixed className="h-4 w-4" />
          )}
          {locating ? 'Locating...' : 'Use my location'}
        </Button>
      </CardContent>
    </Card>
  )
}
