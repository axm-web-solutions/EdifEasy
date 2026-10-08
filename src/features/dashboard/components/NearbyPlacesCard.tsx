import { useEffect, useMemo, useRef, useState, type ReactNode } from 'react'
import { Card, Segmented, Skeleton, Tag, Tooltip } from 'antd'
import { Link } from 'react-router-dom'
import { MapPin, Navigation } from 'lucide-react'
import L from 'leaflet'
import 'leaflet/dist/leaflet.css'
import { EmptyState, ErrorState } from '@/components/ui/states'
import { useCondominium } from '@/hooks/useCondominiums'
import { useCondominiumLocation, useNearbyPlaces } from '@/hooks/usePlaces'
import { PLACE_CATEGORIES, type NearbyPlace, type PlaceCategory } from '@/services/placesService'

const RADIUS_OPTIONS = [
  { label: '500 m', value: 500 },
  { label: '1 km', value: 1000 },
  { label: '2 km', value: 2000 },
]

/** Cuantos lugares se listan como maximo (el mapa los muestra todos). */
const LIST_LIMIT = 60

function formatDistance(meters: number) {
  return meters < 1000 ? `${Math.round(meters)} m` : `${(meters / 1000).toFixed(1)} km`
}

function brandColor() {
  const value = getComputedStyle(document.documentElement)
    .getPropertyValue('--edifeasy-brand')
    .trim()
  return value || '#2563eb'
}

/** Popup construido con nodos DOM: los nombres vienen de OSM y no se interpretan como HTML. */
function buildPopup(title: string, subtitle: string, detail?: string | null) {
  const root = document.createElement('div')
  const strong = document.createElement('strong')
  strong.textContent = title
  root.appendChild(strong)
  const sub = document.createElement('div')
  sub.style.fontSize = '12px'
  sub.style.color = '#64748b'
  sub.textContent = subtitle
  root.appendChild(sub)
  if (detail) {
    const extra = document.createElement('div')
    extra.style.fontSize = '12px'
    extra.textContent = detail
    root.appendChild(extra)
  }
  return root
}

interface NearbyPlacesCardProps {
  condominiumId: string | null
  /** Ruta donde se edita la direccion; solo se muestra a quien puede editarla. */
  editAddressPath?: string
  dataTour?: string
}

/**
 * Mapa con la ubicacion del condominio y los comercios y servicios reales que
 * lo rodean (centros comerciales, supermercados, restaurantes, etc.), tomados
 * de OpenStreetMap a partir de la direccion registrada.
 */
export function NearbyPlacesCard({
  condominiumId,
  editAddressPath,
  dataTour,
}: NearbyPlacesCardProps) {
  const [radius, setRadius] = useState(1000)
  const [hidden, setHidden] = useState<Set<PlaceCategory>>(new Set())

  const condominiumQuery = useCondominium(condominiumId)
  const condominium = condominiumQuery.data
  const locationQuery = useCondominiumLocation(condominium)
  const point = locationQuery.data ?? null
  const placesQuery = useNearbyPlaces(point, radius)

  const places = useMemo(() => placesQuery.data ?? [], [placesQuery.data])
  const visiblePlaces = useMemo(
    () => places.filter((place) => !hidden.has(place.category)),
    [places, hidden],
  )
  const counts = useMemo(() => {
    const result = new Map<PlaceCategory, number>()
    for (const place of places) result.set(place.category, (result.get(place.category) ?? 0) + 1)
    return result
  }, [places])

  const mapElement = useRef<HTMLDivElement | null>(null)
  const mapRef = useRef<L.Map | null>(null)
  const centerLayer = useRef<L.LayerGroup | null>(null)
  const placesLayer = useRef<L.LayerGroup | null>(null)
  const markers = useRef(new Map<string, L.CircleMarker>())

  // Crea el mapa una sola vez, cuando ya hay coordenadas.
  useEffect(() => {
    if (!point || !mapElement.current || mapRef.current) return
    const map = L.map(mapElement.current, { scrollWheelZoom: false }).setView(
      [point.lat, point.lon],
      15,
    )
    L.tileLayer('https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png', {
      maxZoom: 19,
      attribution: '&copy; <a href="https://www.openstreetmap.org/copyright">OpenStreetMap</a>',
    }).addTo(map)
    centerLayer.current = L.layerGroup().addTo(map)
    placesLayer.current = L.layerGroup().addTo(map)
    mapRef.current = map
    const markerIndex = markers.current

    return () => {
      map.remove()
      mapRef.current = null
      centerLayer.current = null
      placesLayer.current = null
      markerIndex.clear()
    }
  }, [point])

  // Marcador del condominio y circulo del radio de busqueda.
  useEffect(() => {
    const map = mapRef.current
    const layer = centerLayer.current
    if (!map || !layer || !point) return
    layer.clearLayers()
    const color = brandColor()
    const circle = L.circle([point.lat, point.lon], {
      radius,
      color,
      weight: 1,
      fillColor: color,
      fillOpacity: 0.06,
      interactive: false,
    }).addTo(layer)
    const icon = L.divIcon({
      className: '',
      html: `<div style="width:28px;height:28px;border-radius:50% 50% 50% 0;transform:rotate(-45deg);background:${color};border:3px solid #fff;box-shadow:0 2px 6px rgb(0 0 0 / .35)"></div>`,
      iconSize: [28, 28],
      iconAnchor: [14, 28],
      popupAnchor: [0, -26],
    })
    L.marker([point.lat, point.lon], { icon, zIndexOffset: 1000 })
      .bindPopup(buildPopup(condominium?.name ?? 'Condominio', condominium?.address ?? point.label))
      .addTo(layer)
    map.fitBounds(circle.getBounds(), { padding: [12, 12] })
  }, [point, radius, condominium?.name, condominium?.address])

  // Marcadores de los lugares visibles.
  useEffect(() => {
    const layer = placesLayer.current
    if (!layer) return
    layer.clearLayers()
    markers.current.clear()
    for (const place of visiblePlaces) {
      const meta = PLACE_CATEGORIES[place.category]
      const marker = L.circleMarker([place.lat, place.lon], {
        radius: 7,
        color: '#fff',
        weight: 2,
        fillColor: meta.hex,
        fillOpacity: 0.95,
      })
        .bindPopup(
          buildPopup(
            place.name,
            `${meta.label} · ${formatDistance(place.distance)}`,
            place.address,
          ),
        )
        .addTo(layer)
      markers.current.set(place.id, marker)
    }
  }, [visiblePlaces])

  const focusPlace = (place: NearbyPlace) => {
    const map = mapRef.current
    if (!map) return
    map.setView([place.lat, place.lon], Math.max(map.getZoom(), 17))
    markers.current.get(place.id)?.openPopup()
  }

  const toggleCategory = (category: PlaceCategory, checked: boolean) => {
    setHidden((current) => {
      const next = new Set(current)
      if (checked) next.delete(category)
      else next.add(category)
      return next
    })
  }

  const directionsUrl = point
    ? `https://www.google.com/maps/dir/?api=1&destination=${point.lat},${point.lon}`
    : null

  const hasLocationData = Boolean(condominium?.address || condominium?.city)

  let body: ReactNode
  if (condominiumQuery.isLoading || locationQuery.isLoading) {
    body = (
      <Skeleton.Node active className="!block !h-[380px] !w-full [&>div]:!h-full [&>div]:!w-full" />
    )
  } else if (!hasLocationData) {
    body = (
      <EmptyState
        title="El condominio no tiene direccion registrada"
        description="Registra la direccion y la ciudad para ver su ubicacion y los lugares cercanos."
        action={editAddressPath ? <Link to={editAddressPath}>Registrar direccion</Link> : undefined}
      />
    )
  } else if (locationQuery.isError) {
    body = (
      <ErrorState
        title="No se pudo ubicar el condominio en el mapa"
        onRetry={() => void locationQuery.refetch()}
      />
    )
  } else if (!point) {
    body = (
      <EmptyState
        title="No encontramos la direccion en el mapa"
        description="Revisa que la direccion y la ciudad del condominio esten bien escritas."
        action={editAddressPath ? <Link to={editAddressPath}>Revisar direccion</Link> : undefined}
      />
    )
  } else {
    body = (
      <div className="grid gap-4 lg:grid-cols-[minmax(0,1fr)_340px]">
        <div className="relative isolate z-0 overflow-hidden rounded-lg border border-slate-200">
          <div ref={mapElement} className="h-[300px] w-full sm:h-[380px]" />
        </div>

        <div className="flex min-w-0 flex-col">
          <div className="mb-3 flex flex-wrap gap-1.5">
            {(Object.keys(PLACE_CATEGORIES) as PlaceCategory[])
              .filter((category) => counts.has(category))
              .map((category) => (
                <Tag.CheckableTag
                  key={category}
                  checked={!hidden.has(category)}
                  onChange={(checked) => toggleCategory(category, checked)}
                  className="!m-0 !border !border-slate-200"
                >
                  <span
                    className="mr-1.5 inline-block h-2 w-2 rounded-full align-middle"
                    style={{ background: PLACE_CATEGORIES[category].hex }}
                  />
                  {PLACE_CATEGORIES[category].label} ({counts.get(category)})
                </Tag.CheckableTag>
              ))}
          </div>

          {placesQuery.isLoading ? (
            <div className="space-y-2">
              {Array.from({ length: 6 }).map((_, index) => (
                <Skeleton.Input key={index} active block style={{ height: 40 }} />
              ))}
            </div>
          ) : placesQuery.isError ? (
            <ErrorState
              title="No se pudieron cargar los lugares cercanos"
              description="El servicio de mapas no respondio. Intenta de nuevo en unos segundos."
              onRetry={() => void placesQuery.refetch()}
            />
          ) : visiblePlaces.length === 0 ? (
            <EmptyState
              title="Sin lugares en este radio"
              description="Amplia el radio de busqueda o activa mas categorias."
            />
          ) : (
            <ul className="m-0 max-h-[320px] list-none divide-y divide-slate-100 overflow-y-auto p-0 pr-1">
              {visiblePlaces.slice(0, LIST_LIMIT).map((place) => (
                <li key={place.id}>
                  <button
                    type="button"
                    onClick={() => focusPlace(place)}
                    className="flex w-full cursor-pointer items-center gap-3 border-0 bg-transparent px-1 py-2 text-left hover:bg-slate-50"
                  >
                    <span
                      className="h-2.5 w-2.5 shrink-0 rounded-full"
                      style={{ background: PLACE_CATEGORIES[place.category].hex }}
                    />
                    <span className="min-w-0 flex-1">
                      <span className="block truncate text-sm font-medium text-slate-800">
                        {place.name}
                      </span>
                      <span className="block truncate text-xs text-slate-500">
                        {PLACE_CATEGORIES[place.category].label}
                        {place.address ? ` · ${place.address}` : ''}
                      </span>
                    </span>
                    <span className="shrink-0 text-xs tabular-nums text-slate-500">
                      {formatDistance(place.distance)}
                    </span>
                  </button>
                </li>
              ))}
            </ul>
          )}

          {visiblePlaces.length > LIST_LIMIT ? (
            <p className="m-0 mt-2 text-xs text-slate-400">
              Mostrando los {LIST_LIMIT} mas cercanos de {visiblePlaces.length}. Todos aparecen en
              el mapa.
            </p>
          ) : null}
        </div>
      </div>
    )
  }

  return (
    <Card
      className="surface-card"
      data-tour={dataTour}
      title={
        <div className="flex min-w-0 items-center gap-2">
          <MapPin size={16} className="shrink-0 text-slate-500" />
          <span className="truncate text-sm font-semibold">Ubicacion y alrededores</span>
        </div>
      }
      extra={
        point ? (
          <div className="flex items-center gap-2">
            <Segmented
              size="small"
              options={RADIUS_OPTIONS}
              value={radius}
              onChange={(value) => setRadius(value as number)}
            />
            {directionsUrl ? (
              <Tooltip title="Como llegar">
                <a
                  href={directionsUrl}
                  target="_blank"
                  rel="noopener noreferrer"
                  className="hidden items-center gap-1 text-sm sm:inline-flex"
                >
                  <Navigation size={14} /> Como llegar
                </a>
              </Tooltip>
            ) : null}
          </div>
        ) : null
      }
    >
      {point ? (
        <p className="m-0 mb-3 text-xs text-slate-500">
          {point.approximate
            ? `Ubicacion aproximada (no se encontro la direccion exacta): ${point.label}`
            : point.label}
        </p>
      ) : null}
      {body}
      {point ? (
        <p className="m-0 mt-3 text-[11px] text-slate-400">
          Datos de lugares y mapa: © colaboradores de OpenStreetMap.
        </p>
      ) : null}
    </Card>
  )
}
