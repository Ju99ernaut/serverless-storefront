'use client'

import dynamic from 'next/dynamic'
import { DeliveryLocationInput } from './delivery-location-input'
import type { Coordinates } from '@/lib/utils/delivery-fee'

const LeafletPinMap = dynamic(() => import('./leaflet-pin-map').then((mod) => mod.LeafletPinMap), {
  ssr: false,
  loading: () => (
    <div className="flex h-64 w-full items-center justify-center bg-muted/40 text-sm text-muted-foreground">
      Loading map...
    </div>
  ),
})

interface DeliveryLocationPickerProps {
  value: string | null
  storeCoords?: Coordinates
  onChange: (next: string) => void
}

export function DeliveryLocationPicker({
  value,
  storeCoords,
  onChange,
}: DeliveryLocationPickerProps) {
  return (
    <DeliveryLocationInput
      value={value}
      onChange={onChange}
      renderMap={({ coords, onSelectCoords }) => (
        <LeafletPinMap coords={coords} storeCoords={storeCoords} onSelectCoords={onSelectCoords} />
      )}
    />
  )
}
