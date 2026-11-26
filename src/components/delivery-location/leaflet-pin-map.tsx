'use client'

import { useEffect, useMemo } from 'react'
import L from 'leaflet'
import { MapContainer, Marker, TileLayer, useMap, useMapEvents } from 'react-leaflet'
import type { Coordinates } from '@/lib/utils/delivery-fee'
import 'leaflet/dist/leaflet.css'

interface LeafletPinMapProps {
  coords: Coordinates
  storeCoords?: Coordinates
  onSelectCoords: (coords: Coordinates) => void
}

function createPinIcon(variant: 'customer' | 'store') {
  const bg =
    variant === 'customer' ? 'bg-primary text-primary-foreground' : 'bg-amber-600 text-white'

  return L.divIcon({
    className: '',
    iconSize: [44, 24],
    iconAnchor: [22, 24],
    html: `<div class="flex items-center justify-center rounded-full w-4 h-4 font-semibold shadow-md border border-white ${bg}"></div>`,
  })
}

function MapClickAndSync({
  coords,
  onSelectCoords,
}: {
  coords: Coordinates
  onSelectCoords: (coords: Coordinates) => void
}) {
  const map = useMap()

  useMapEvents({
    click(e) {
      onSelectCoords({ lat: e.latlng.lat, lng: e.latlng.lng })
    },
  })

  useEffect(() => {
    map.panTo([coords.lat, coords.lng], { animate: true })
  }, [coords.lat, coords.lng, map])

  return null
}

export function LeafletPinMap({ coords, storeCoords, onSelectCoords }: LeafletPinMapProps) {
  const customerIcon = useMemo(() => createPinIcon('customer'), [])
  const storeIcon = useMemo(() => createPinIcon('store'), [])

  return (
    <div className="h-64 w-full">
      <MapContainer
        center={[coords.lat, coords.lng]}
        zoom={14}
        scrollWheelZoom={false}
        className="h-full w-full z-0"
      >
        <TileLayer
          attribution='&copy; <a href="https://www.openstreetmap.org/copyright">OpenStreetMap</a>'
          url="https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png"
        />

        <MapClickAndSync coords={coords} onSelectCoords={onSelectCoords} />

        {storeCoords && (
          <Marker
            position={[storeCoords.lat, storeCoords.lng]}
            icon={storeIcon}
            interactive={false}
          />
        )}

        <Marker
          position={[coords.lat, coords.lng]}
          icon={customerIcon}
          draggable
          eventHandlers={{
            dragend(e) {
              const marker = e.target as L.Marker
              const pos = marker.getLatLng()
              onSelectCoords({ lat: pos.lat, lng: pos.lng })
            },
          }}
        />
      </MapContainer>
    </div>
  )
}
