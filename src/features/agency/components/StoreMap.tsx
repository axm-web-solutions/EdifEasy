import { useEffect, useRef } from 'react'
import L from 'leaflet'
import 'leaflet/dist/leaflet.css'

export interface StoreMapPoint {
  id: string
  lat: number
  lng: number
  label: string
  title: string
  subtitle: string
  cover: string | null
  href: string
}

const escape = (value: string) => value.replace(/[&<>"']/g, (char) => `&#${char.charCodeAt(0)};`)

function pillHtml(label: string, active: boolean, accent: string) {
  const background = active ? '#0f172a' : '#ffffff'
  const color = active ? '#ffffff' : '#0f172a'
  return `<span style="display:inline-block;transform:translate(-50%,-50%) ${active ? 'scale(1.12)' : ''};
    background:${background};color:${color};border-radius:999px;padding:5px 10px;font:600 12px/1 system-ui,sans-serif;
    box-shadow:0 2px 8px rgb(0 0 0 / .22);border:1px solid ${active ? accent : 'rgb(0 0 0 / .08)'};
    white-space:nowrap;transition:transform .15s ease">${escape(label)}</span>`
}

/**
 * Mapa de la tienda estilo Airbnb: un marcador con el precio por propiedad.
 * `activeId` resalta el marcador de la tarjeta que se esta mirando. Con
 * `approximate` dibuja un circulo de zona en vez de un punto (ficha).
 */
export function StoreMap({
  points,
  activeId = null,
  onSelect,
  accent,
  approximate = false,
  className = '',
  label = 'Mapa de propiedades',
}: {
  label?: string
  points: StoreMapPoint[]
  activeId?: string | null
  onSelect?: (id: string) => void
  accent: string
  approximate?: boolean
  className?: string
}) {
  const element = useRef<HTMLDivElement | null>(null)
  const map = useRef<L.Map | null>(null)
  const layer = useRef<L.LayerGroup | null>(null)
  const markers = useRef(new Map<string, L.Marker>())

  useEffect(() => {
    if (!element.current || map.current) return
    map.current = L.map(element.current, {
      zoomControl: true,
      scrollWheelZoom: false,
      attributionControl: true,
    })
    L.tileLayer('https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png', {
      maxZoom: 19,
      attribution: '&copy; OpenStreetMap',
    }).addTo(map.current)
    layer.current = L.layerGroup().addTo(map.current)
    return () => {
      map.current?.remove()
      map.current = null
    }
  }, [])

  // Marcadores (o circulo de zona) cada vez que cambian los puntos.
  useEffect(() => {
    const instance = map.current
    const group = layer.current
    if (!instance || !group) return
    group.clearLayers()
    markers.current.clear()
    if (points.length === 0) {
      instance.setView([4.711, -74.0721], 11)
      return
    }
    if (approximate) {
      const point = points[0]
      L.circle([point.lat, point.lng], {
        radius: 350,
        color: accent,
        fillColor: accent,
        fillOpacity: 0.18,
        weight: 2,
      }).addTo(group)
      instance.setView([point.lat, point.lng], 14)
      return
    }
    for (const point of points) {
      const marker = L.marker([point.lat, point.lng], {
        icon: L.divIcon({
          className: '',
          html: pillHtml(point.label, false, accent),
          iconSize: [0, 0],
        }),
        keyboard: true,
        title: point.title,
      })
      marker.bindPopup(
        `<a href="${escape(point.href)}" style="display:block;width:220px;color:inherit;text-decoration:none">
          ${point.cover ? `<img src="${escape(point.cover)}" alt="" style="width:100%;height:120px;object-fit:cover;border-radius:10px" />` : ''}
          <strong style="display:block;margin-top:6px;font-size:13px">${escape(point.title)}</strong>
          <span style="display:block;color:#64748b;font-size:12px">${escape(point.subtitle)}</span>
          <span style="display:block;font-weight:600;font-size:13px;margin-top:2px">${escape(point.label)}</span>
        </a>`,
        { closeButton: false, offset: [0, -6] },
      )
      marker.on('click', () => onSelect?.(point.id))
      marker.addTo(group)
      markers.current.set(point.id, marker)
    }
    const bounds = L.latLngBounds(points.map((point) => [point.lat, point.lng]))
    instance.fitBounds(bounds, { padding: [48, 48], maxZoom: 14 })
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [points, approximate, accent])

  // Resalta el marcador activo sin redibujar el mapa.
  useEffect(() => {
    for (const [id, marker] of markers.current) {
      const point = points.find((item) => item.id === id)
      if (!point) continue
      marker.setIcon(
        L.divIcon({
          className: '',
          html: pillHtml(point.label, id === activeId, accent),
          iconSize: [0, 0],
        }),
      )
      marker.setZIndexOffset(id === activeId ? 1000 : 0)
    }
  }, [activeId, points, accent])

  return (
    <div
      ref={element}
      className={`h-full w-full ${className}`}
      role="region"
      aria-label={label}
    />
  )
}
