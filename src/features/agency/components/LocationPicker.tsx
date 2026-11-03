import { useEffect, useRef } from 'react'
import L from 'leaflet'
import 'leaflet/dist/leaflet.css'

/**
 * Mapa para ubicar una propiedad: un toque (o arrastrar el pin) fija la
 * ubicacion exacta. La tienda solo mostrara una zona aproximada.
 */
export function LocationPicker({
  lat,
  lng,
  onChange,
}: {
  lat: number | null
  lng: number | null
  onChange: (point: { lat: number; lng: number }) => void
}) {
  const element = useRef<HTMLDivElement | null>(null)
  const map = useRef<L.Map | null>(null)
  const marker = useRef<L.Marker | null>(null)
  const change = useRef(onChange)
  change.current = onChange

  useEffect(() => {
    if (!element.current || map.current) return
    map.current = L.map(element.current, { scrollWheelZoom: false }).setView([4.711, -74.0721], 11)
    L.tileLayer('https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png', {
      maxZoom: 19,
      attribution: '&copy; OpenStreetMap',
    }).addTo(map.current)
    map.current.on('click', (event: L.LeafletMouseEvent) => {
      change.current({ lat: event.latlng.lat, lng: event.latlng.lng })
    })
    return () => {
      map.current?.remove()
      map.current = null
      marker.current = null
    }
  }, [])

  useEffect(() => {
    const instance = map.current
    if (!instance) return
    if (lat === null || lng === null) {
      marker.current?.remove()
      marker.current = null
      return
    }
    if (!marker.current) {
      marker.current = L.marker([lat, lng], {
        draggable: true,
        icon: L.divIcon({
          className: '',
          html: '<span style="display:block;width:22px;height:22px;transform:translate(-50%,-50%);border-radius:50%;background:#0f172a;border:4px solid #fff;box-shadow:0 2px 8px rgb(0 0 0 / .35)"></span>',
          iconSize: [0, 0],
        }),
      }).addTo(instance)
      marker.current.on('dragend', () => {
        const point = marker.current?.getLatLng()
        if (point) change.current({ lat: point.lat, lng: point.lng })
      })
      instance.setView([lat, lng], 16)
    } else {
      marker.current.setLatLng([lat, lng])
    }
  }, [lat, lng])

  return (
    <div ref={element} className="h-56 w-full overflow-hidden rounded-xl ring-1 ring-slate-200" />
  )
}
